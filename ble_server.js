const bleno = require('@abandonware/bleno');
const fs = require('fs');
const { exec } = require('child_process');

const SERVICE_UUID = '12345678-1234-5678-9abc-123456789abc';
const WIFI_CHAR_UUID = '12345678-1234-5678-9abc-123456789abd';
const DEVICE_INFO_CHAR_UUID = '12345678-1234-5678-9abc-123456789abe';

const CONFIG_PATH = '/etc/smartwardrobe/config.json';
const DEVICE_NAME = 'SmartWardrobe';
const DEVICE_SERIAL = '0001';
const DEVICE_MAC = '2c:cf:67:c6:97:2c';

// Enhanced logging
const log = (level, ...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}:`, ...args);
};

// Ensure config directory exists
if (!fs.existsSync('/etc/smartwardrobe')) {
  try { 
    fs.mkdirSync('/etc/smartwardrobe', { recursive: true }); 
    log('INFO', '📁 Config directory created');
  } catch (e) { 
    log('ERROR', '❌ Failed to create config directory:', e.message);
  }
}

// Check permissions
if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  log('WARN', '⚠️  Running without root. Run: sudo setcap cap_net_raw+eip $(which node)');
}

class WifiConfigCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: WIFI_CHAR_UUID,
      properties: ['write', 'writeWithoutResponse'],
      descriptors: [
        new bleno.Descriptor({
          uuid: '2901',
          value: Buffer.from('WiFi Config: JSON with ssid, password, etc.', 'utf8')
        })
      ]
    });
    this.writeBuffer = Buffer.alloc(0);
    this.isWriting = false;
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    log('DEBUG', '📝 WiFi write request - length:', data.length, 'offset:', offset, 'withoutResponse:', withoutResponse);
    
    // Prevent concurrent writes
    if (this.isWriting) {
      log('WARN', '⚠️  Write already in progress, rejecting');
      return callback(this.RESULT_UNLIKELY_ERROR);
    }

    this.isWriting = true;

    try {
      // Handle fragmented writes (common with longer JSON payloads)
      if (offset === 0) {
        this.writeBuffer = Buffer.from(data);
      } else {
        this.writeBuffer = Buffer.concat([this.writeBuffer, data]);
      }

      // Check if this is the final fragment (usually when data < 20 bytes or withoutResponse is true)
      const isComplete = data.length < 20 || withoutResponse || offset === 0;
      
      if (!isComplete) {
        log('DEBUG', '📦 Partial write received, buffer size:', this.writeBuffer.length);
        this.isWriting = false;
        return callback(this.RESULT_SUCCESS);
      }

      log('DEBUG', '📄 Complete data received, processing... Total size:', this.writeBuffer.length);
      
      const s = this.writeBuffer.toString('utf8').trim();
      log('DEBUG', '📄 Raw data preview:', s.substring(0, 100) + (s.length > 100 ? '...' : ''));
      
      let cfg = null;
      
      try {
        if (s.startsWith('{')) {
          cfg = JSON.parse(s);
        } else {
          const parts = s.split(';');
          cfg = {
            ssid: parts[0] || null,
            password: parts[1] || null,
            apiKey: parts[2] || null,
            deviceSerial: parts[3] || null,
            backendUrl: parts[4] || 'http://localhost:3001'
          };
        }
      } catch (parseErr) {
        log('ERROR', '❌ JSON parse failed:', parseErr.message);
        log('DEBUG', 'Raw data that failed to parse:', s);
        this.isWriting = false;
        return callback(this.RESULT_UNLIKELY_ERROR);
      }

      // Validate required fields
      if (!cfg || !cfg.ssid || !cfg.password) {
        log('ERROR', '❌ Invalid wifi payload:', { 
          hasConfig: !!cfg, 
          hasSSID: !!(cfg && cfg.ssid), 
          hasPassword: !!(cfg && cfg.password) 
        });
        this.isWriting = false;
        return callback(this.RESULT_UNLIKELY_ERROR);
      }

      log('INFO', '✅ Valid WiFi config received for SSID:', cfg.ssid);

      // Save config atomically
      try {
        const configToSave = {
          ...cfg,
          receivedAt: new Date().toISOString(),
          deviceSerial: DEVICE_SERIAL,
          deviceMac: DEVICE_MAC
        };
        
        fs.writeFileSync(CONFIG_PATH + '.tmp', JSON.stringify(configToSave, null, 2));
        fs.renameSync(CONFIG_PATH + '.tmp', CONFIG_PATH);
        log('INFO', '✅ Config saved to', CONFIG_PATH);
      } catch (fsErr) {
        log('ERROR', '❌ Failed to write config:', fsErr.message);
        this.isWriting = false;
        return callback(this.RESULT_UNLIKELY_ERROR);
      }

      // Trigger WiFi connection (non-blocking)
      this.connectToWifi(cfg.ssid, cfg.password);

      // Reset buffer for next write
      this.writeBuffer = Buffer.alloc(0);
      this.isWriting = false;
      
      callback(this.RESULT_SUCCESS);
      
    } catch (e) {
      log('ERROR', '❌ Write request error:', e.message, e.stack);
      this.isWriting = false;
      callback(this.RESULT_UNLIKELY_ERROR);
    }
  }

  connectToWifi(ssid, password) {
    // Escape special characters for shell
    const escapedSSID = ssid.replace(/"/g, '\\"');
    const escapedPassword = password.replace(/"/g, '\\"');
    
    const cmd = `nmcli device wifi connect "${escapedSSID}" password "${escapedPassword}" 2>&1 || nmcli connection up "${escapedSSID}" 2>&1`;
    
    log('INFO', '🔄 Starting WiFi connection to:', ssid);
    
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        log('ERROR', '❌ WiFi connection failed:', err.message);
        log('DEBUG', 'stdout:', stdout, 'stderr:', stderr);
      } else {
        log('INFO', '✅ WiFi connection successful:', stdout);
        
        // Optional: Get IP address after connection
        exec('hostname -I', (ipErr, ipOut) => {
          if (!ipErr && ipOut.trim()) {
            log('INFO', '🌐 Device IP:', ipOut.trim().split(' ')[0]);
          }
        });
      }
    });
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    log('DEBUG', '🔔 WiFi characteristic subscribed, maxValueSize:', maxValueSize);
  }

  onUnsubscribe() {
    log('DEBUG', '🔕 WiFi characteristic unsubscribed');
  }
}

class DeviceInfoCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: DEVICE_INFO_CHAR_UUID,
      properties: ['read'],
      descriptors: [
        new bleno.Descriptor({
          uuid: '2901',
          value: Buffer.from('Device Info: JSON with serial, mac, etc.', 'utf8')
        })
      ]
    });
    
    // Pre-calculate device info to avoid doing it on each read
    this.deviceInfoBuffer = null;
    this.prepareDeviceInfo();
  }

  prepareDeviceInfo() {
    const deviceInfo = {
      serialNumber: DEVICE_SERIAL,
      macAddress: DEVICE_MAC,
      deviceName: DEVICE_NAME,
      firmwareVersion: '1.0.1',
      timestamp: new Date().toISOString(),
      bluetoothReady: true
    };

    const jsonString = JSON.stringify(deviceInfo);
    this.deviceInfoBuffer = Buffer.from(jsonString, 'utf8');
    log('DEBUG', '📋 Device info prepared, size:', this.deviceInfoBuffer.length);
  }

  onReadRequest(offset, callback) {
    log('DEBUG', '📖 Device info read request, offset:', offset);
    
    try {
      if (!this.deviceInfoBuffer) {
        this.prepareDeviceInfo();
      }

      if (offset > this.deviceInfoBuffer.length) {
        log('WARN', '❌ Invalid offset:', offset, 'buffer length:', this.deviceInfoBuffer.length);
        return callback(this.RESULT_INVALID_OFFSET, null);
      }

      const chunk = this.deviceInfoBuffer.slice(offset);
      log('DEBUG', '✅ Sending device info chunk, length:', chunk.length, 'remaining:', this.deviceInfoBuffer.length - offset - chunk.length);
      
      callback(this.RESULT_SUCCESS, chunk);
      
    } catch (e) {
      log('ERROR', '❌ Device info read error:', e.message);
      callback(this.RESULT_UNLIKELY_ERROR, null);
    }
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    log('DEBUG', '🔔 Device info characteristic subscribed');
  }

  onUnsubscribe() {
    log('DEBUG', '🔕 Device info characteristic unsubscribed');
  }
}

// Create characteristics
const wifiChar = new WifiConfigCharacteristic();
const deviceInfoChar = new DeviceInfoCharacteristic();

const primaryService = new bleno.PrimaryService({
  uuid: SERVICE_UUID,
  characteristics: [wifiChar, deviceInfoChar]
});

// Enhanced state tracking
let state = {
  bluetooth: 'unknown',
  advertising: false,
  servicesSet: false,
  connected: false,
  clientAddress: null,
  reconnectTimer: null,
  startupComplete: false
};

const setState = (key, value) => {
  const oldValue = state[key];
  state[key] = value;
  if (oldValue !== value) {
    log('DEBUG', `🔄 State change: ${key} ${oldValue} → ${value}`);
  }
};

const startServices = () => {
  if (state.bluetooth !== 'poweredOn') {
    log('WARN', '⏳ Bluetooth not ready, current state:', state.bluetooth);
    return;
  }

  if (state.servicesSet && state.advertising) {
    log('DEBUG', '✅ Services already running');
    return;
  }

  log('INFO', '🔧 Setting GATT services...');
  
  bleno.setServices([primaryService], (setErr) => {
    if (setErr) {
      log('ERROR', '❌ setServices failed:', setErr.message);
      setState('servicesSet', false);
      
      // Retry after delay
      setTimeout(() => {
        if (state.bluetooth === 'poweredOn') {
          log('INFO', '🔄 Retrying service setup...');
          startServices();
        }
      }, 2000);
      return;
    }
    
    setState('servicesSet', true);
    log('INFO', '✅ Services set successfully');
    
    if (!state.advertising) {
      log('INFO', '📡 Starting advertising:', DEVICE_NAME);
      
      // Use shorter device name to avoid issues
      const shortName = DEVICE_NAME.length > 8 ? DEVICE_NAME.substring(0, 8) : DEVICE_NAME;
      
      bleno.startAdvertising(shortName, [SERVICE_UUID], (advErr) => {
        if (advErr) {
          log('ERROR', '❌ startAdvertising failed:', advErr.message);
          setState('advertising', false);
        }
        // Success is handled in advertisingStart event
      });
    }
  });
};

const stopServices = () => {
  log('INFO', '🛑 Stopping services...');
  setState('advertising', false);
  setState('servicesSet', false);
  setState('connected', false);
  setState('clientAddress', null);
  
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    setState('reconnectTimer', null);
  }
  
  bleno.stopAdvertising(() => {
    bleno.setServices([], () => {
      log('INFO', '🛑 Services stopped cleanly');
    });
  });
};

const scheduleReconnect = (delay = 2000) => {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
  }
  
  setState('reconnectTimer', setTimeout(() => {
    if (state.bluetooth === 'poweredOn' && !state.advertising && !state.connected) {
      log('INFO', '🔄 Restarting services after disconnect...');
      startServices();
    }
    setState('reconnectTimer', null);
  }, delay));
};

// Enhanced event handlers
bleno.on('stateChange', (newState) => {
  log('INFO', '🔄 Bluetooth state changed:', state.bluetooth, '→', newState);
  setState('bluetooth', newState);
  
  if (newState === 'poweredOn') {
    // Give BlueZ a moment to settle
    setTimeout(() => {
      if (state.bluetooth === 'poweredOn') {
        startServices();
      }
    }, 500);
  } else {
    stopServices();
  }
});

bleno.on('advertisingStart', (err) => {
  if (err) {
    log('ERROR', '❌ Advertising start error:', err.message);
    setState('advertising', false);
  } else {
    log('INFO', '✅ Advertising started successfully');
    setState('advertising', true);
    setState('startupComplete', true);
  }
});

bleno.on('advertisingStop', () => {
  log('INFO', '🛑 Advertising stopped');
  setState('advertising', false);
});

bleno.on('accept', (clientAddress) => {
  log('INFO', '🤝 Client connected:', clientAddress);
  setState('connected', true);
  setState('clientAddress', clientAddress);
  
  // Clear any pending reconnect
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    setState('reconnectTimer', null);
  }
});

bleno.on('disconnect', (clientAddress) => {
  log('INFO', '👋 Client disconnected:', clientAddress);
  setState('connected', false);
  setState('clientAddress', null);
  
  // Schedule reconnect with delay to avoid BlueZ conflicts
  scheduleReconnect(2000);
});

bleno.on('servicesSet', (error) => {
  if (error) {
    log('ERROR', '❌ Services set callback error:', error.message);
    setState('servicesSet', false);
  } else {
    log('INFO', '✅ Services set callback success');
    setState('servicesSet', true);
  }
});

bleno.on('mtuChange', (mtu, clientAddress) => {
  log('INFO', '📏 MTU changed to:', mtu, 'for client:', clientAddress);
});

// Additional error handling
bleno.on('rssiUpdate', (rssi) => {
  log('DEBUG', '📶 RSSI updated:', rssi);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  log('INFO', `🛑 ${signal} received, shutting down gracefully...`);
  stopServices();
  
  setTimeout(() => {
    log('INFO', '👋 Shutdown complete');
    process.exit(0);
  }, 1000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log('ERROR', '💥 Uncaught exception:', err.message);
  log('DEBUG', err.stack);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', '💥 Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, just log it
});

// Startup
log('INFO', '🚀 BLE Server starting...');
log('INFO', '📱 Device:', DEVICE_NAME);
log('INFO', '🆔 Service UUID:', SERVICE_UUID);
log('INFO', '⚡ Ensure node has CAP_NET_RAW: sudo setcap cap_net_raw+eip $(which node)');
log('INFO', '🔍 Current Bluetooth state:', bleno.state);

// Print state summary every 30 seconds in debug mode
if (process.env.DEBUG) {
  setInterval(() => {
    log('DEBUG', '📊 State summary:', {
      bluetooth: state.bluetooth,
      advertising: state.advertising,
      servicesSet: state.servicesSet,
      connected: state.connected,
      startupComplete: state.startupComplete
    });
  }, 30000);
}

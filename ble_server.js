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

// Ensure config directory exists
if (!fs.existsSync('/etc/smartwardrobe')) {
  try { fs.mkdirSync('/etc/smartwardrobe', { recursive: true }); } catch (e) { console.error(e); }
}

// Check permissions
if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.warn('⚠️  Running without root. Run: sudo setcap cap_net_raw+eip $(which node)');
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
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    console.log('📝 WiFi write request received, data length:', data.length);
    
    try {
      if (offset && offset > 0) {
        console.warn('❌ Long write not supported, offset:', offset);
        return callback(this.RESULT_ATTR_NOT_LONG);
      }

      const s = data.toString('utf8').trim();
      console.log('📄 Raw data:', s.substring(0, 100) + (s.length > 100 ? '...' : ''));
      
      let cfg = null;
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

      if (!cfg.ssid || !cfg.password) {
        console.error('❌ Invalid wifi payload:', { ssid: !!cfg.ssid, password: !!cfg.password });
        return callback(this.RESULT_UNLIKELY_ERROR);
      }

      // Save config atomically
      try {
        fs.writeFileSync(CONFIG_PATH + '.tmp', JSON.stringify(cfg, null, 2));
        fs.renameSync(CONFIG_PATH + '.tmp', CONFIG_PATH);
        console.log('✅ Config saved to', CONFIG_PATH);
      } catch (fsErr) {
        console.error('❌ Failed to write config:', fsErr);
        return callback(this.RESULT_UNLIKELY_ERROR);
      }

      // Trigger WiFi connection (non-blocking)
      const cmd = `nmcli device wifi connect "${cfg.ssid}" password "${cfg.password}" || nmcli connection up "${cfg.ssid}"`;
      console.log('🔄 Starting WiFi connection...');
      exec(cmd, { timeout: 20000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('❌ nmcli failed:', err.message, stderr);
        } else {
          console.log('✅ nmcli success:', stdout);
        }
      });

      callback(this.RESULT_SUCCESS);
    } catch (e) {
      console.error('❌ Write error:', e);
      callback(this.RESULT_UNLIKELY_ERROR);
    }
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
  }

  onReadRequest(offset, callback) {
    console.log('📖 Device info read request, offset:', offset);
    
    try {
      const deviceInfo = {
        serialNumber: DEVICE_SERIAL,
        macAddress: DEVICE_MAC,
        deviceName: DEVICE_NAME,
        firmwareVersion: '1.0.0',
        timestamp: new Date().toISOString()
      };

      const jsonString = JSON.stringify(deviceInfo);
      const data = Buffer.from(jsonString, 'utf8');

      if (offset > data.length) {
        console.warn('❌ Invalid offset:', offset, 'data length:', data.length);
        return callback(this.RESULT_INVALID_OFFSET, null);
      }

      const chunk = data.slice(offset);
      console.log('✅ Sending device info chunk, length:', chunk.length);
      callback(this.RESULT_SUCCESS, chunk);
    } catch (e) {
      console.error('❌ Read error:', e);
      callback(this.RESULT_UNLIKELY_ERROR, null);
    }
  }
}

const wifiChar = new WifiConfigCharacteristic();
const deviceInfoChar = new DeviceInfoCharacteristic();

const primaryService = new bleno.PrimaryService({
  uuid: SERVICE_UUID,
  characteristics: [wifiChar, deviceInfoChar]
});

// State tracking
let isAdvertising = false;
let isServicesSet = false;
let reconnectTimer = null;

const startServices = () => {
  if (bleno.state !== 'poweredOn') {
    console.log('⏳ Bluetooth not ready, state:', bleno.state);
    return;
  }

  console.log('🔧 Setting GATT services...');
  bleno.setServices([primaryService], (setErr) => {
    if (setErr) {
      console.error('❌ setServices failed:', setErr);
      return;
    }
    
    isServicesSet = true;
    console.log('✅ Services set successfully');
    
    if (!isAdvertising) {
      console.log('📡 Starting advertising:', DEVICE_NAME);
      bleno.startAdvertising(DEVICE_NAME, [SERVICE_UUID], (advErr) => {
        if (advErr) {
          console.error('❌ startAdvertising failed:', advErr);
          isAdvertising = false;
        } else {
          isAdvertising = true;
          console.log('✅ Advertising started successfully');
        }
      });
    }
  });
};

const stopServices = () => {
  console.log('🛑 Stopping services...');
  isAdvertising = false;
  isServicesSet = false;
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  bleno.stopAdvertising(() => {
    bleno.setServices([], () => {
      console.log('🛑 Services stopped');
    });
  });
};

// Event handlers
bleno.on('stateChange', (state) => {
  console.log('🔄 Bluetooth state changed:', state);
  
  if (state === 'poweredOn') {
    // Small delay to let BlueZ settle
    setTimeout(startServices, 100);
  } else {
    stopServices();
  }
});

bleno.on('advertisingStart', (err) => {
  if (err) {
    console.error('❌ Advertising start error:', err);
    isAdvertising = false;
  } else {
    console.log('✅ Advertising started');
    isAdvertising = true;
  }
});

bleno.on('advertisingStop', () => {
  console.log('🛑 Advertising stopped');
  isAdvertising = false;
});

bleno.on('accept', (clientAddress) => {
  console.log('🤝 Client connected:', clientAddress);
  
  // Clear any pending reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
});

bleno.on('disconnect', (clientAddress) => {
  console.log('👋 Client disconnected:', clientAddress);
  
  // Don't immediately restart advertising to avoid BlueZ conflicts
  // Wait a bit for the stack to settle
  if (reconnectTimer) clearTimeout(reconnectTimer);
  
  reconnectTimer = setTimeout(() => {
    if (bleno.state === 'poweredOn' && !isAdvertising) {
      console.log('🔄 Restarting advertising after disconnect...');
      startServices();
    }
  }, 1000); // 1 second delay
});

bleno.on('servicesSet', (error) => {
  if (error) {
    console.error('❌ Services set error:', error);
    isServicesSet = false;
  } else {
    console.log('✅ Services set callback success');
    isServicesSet = true;
  }
});

bleno.on('mtuChange', (mtu) => {
  console.log('📏 MTU changed to:', mtu);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down...');
  stopServices();
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down...');
  stopServices();
  setTimeout(() => process.exit(0), 500);
});

console.log('🚀 BLE Server starting...');
console.log('📱 Device:', DEVICE_NAME);
console.log('🆔 Service UUID:', SERVICE_UUID);
console.log('⚡ Ensure node has CAP_NET_RAW: sudo setcap cap_net_raw+eip $(which node)');

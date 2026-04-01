// protocol.js
// Solax V1 Hybrid/Fit/AC CAN bus frame definitions.
// Sources:
//   https://github.com/rand12345/solax_can_bus (README + DBC)
//   https://github.com/dalathegreat/Battery-Emulator (SOLAX-CAN.cpp)

const FRAMES = {
  0x1871: {
    name: "BMS_Poll",
    fields: [
      { name: "cmd",   startByte: 0, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "byte2", startByte: 2, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "byte4", startByte: 4, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
    ]
  },

  0x1872: {
    name: "BMS_Limits",
    fields: [
      { name: "slave_voltage_max",  startByte: 0, length: 2, signed: false, factor: 0.1, offset: 0, unit: "V", min: 290, max: 400 },
      { name: "slave_voltage_min",  startByte: 2, length: 2, signed: false, factor: 0.1, offset: 0, unit: "V", min: 290, max: 330 },
      { name: "max_charge_rate",    startByte: 4, length: 2, signed: false, factor: 0.1, offset: 0, unit: "A", min: 0,   max: 253 },
      { name: "max_discharge_rate", startByte: 6, length: 2, signed: false, factor: 0.1, offset: 0, unit: "A", min: 0,   max: 35  },
    ]
  },

  0x1873: {
    name: "BMS_PackData",
    fields: [
      { name: "master_voltage", startByte: 0, length: 2, signed: false, factor: 0.1,  offset: 0, unit: "V",   min: 290, max: 400 },
      { name: "current_sensor", startByte: 2, length: 2, signed: true,  factor: 0.1,  offset: 0, unit: "A",   min: -40, max: 40  },
      { name: "soc",            startByte: 4, length: 2, signed: false, factor: 1,    offset: 0, unit: "%",   min: 0,   max: 100 },
      { name: "kwh_remaining",  startByte: 6, length: 2, signed: false, factor: 0.01, offset: 0, unit: "kWh", min: 0,   max: 100 },
    ]
  },

  0x1874: {
    name: "BMS_CellData",
    fields: [
      { name: "cell_temp_max",  startByte: 0, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40,  max: 60   },
      { name: "cell_temp_min",  startByte: 2, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40,  max: 60   },
      { name: "cell_volts_max", startByte: 4, length: 2, signed: false, factor: 1,   offset: 0, unit: "mV", min: 2900, max: 4200 },
      { name: "cell_volts_min", startByte: 6, length: 2, signed: false, factor: 1,   offset: 0, unit: "mV", min: 2900, max: 4200 },
    ]
  },

  0x1875: {
    name: "BMS_Status",
    fields: [
      { name: "temperature_avg", startByte: 0, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40, max: 60 },
      { name: "num_modules",     startByte: 2, length: 1, signed: false, factor: 1,   offset: 0, unit: "",   min: 1,   max: 16 },
      { name: "contactor",       startByte: 4, length: 1, signed: false, factor: 1,   offset: 0, unit: "",   min: 0,   max: 1  },
    ]
  },

  0x1876: {
    name: "BMS_PackTemps",
    fields: [
      { name: "temp_max",    startByte: 0, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40,  max: 60   },
      { name: "cell_mv_max", startByte: 2, length: 2, signed: false, factor: 1,   offset: 0, unit: "mV", min: 2900, max: 4200 },
      { name: "temp_min",    startByte: 4, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40,  max: 60   },
      { name: "cell_mv_min", startByte: 6, length: 2, signed: false, factor: 1,   offset: 0, unit: "mV", min: 2900, max: 4200 },
    ]
  },

  0x1877: {
    name: "BMS_Identity",
    fields: [
      { name: "battery_type",     startByte: 4, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "firmware_version", startByte: 6, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "bms_role",         startByte: 7, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
    ]
  },

  0x1878: {
    name: "BMS_PackStats",
    fields: [
      { name: "pack_voltage",   startByte: 0, length: 2, signed: false, factor: 0.1, offset: 0, unit: "V",  min: 290, max: 400        },
      { name: "total_capacity", startByte: 4, length: 4, signed: false, factor: 1,   offset: 0, unit: "Wh", min: 0,   max: 4294967295 },
    ]
  },

  0x187A: {
    name: "BMS_Announce",
    fields: [
      { name: "flag",         startByte: 0, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "battery_type", startByte: 1, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
    ]
  },

  0x187E: {
    name: "BMS_Ultra",
    fields: [
      { name: "total_capacity_wh", startByte: 0, length: 4, signed: false, factor: 1, offset: 0, unit: "Wh", min: 0, max: 4294967295 },
      { name: "soh",               startByte: 4, length: 1, signed: false, factor: 1, offset: 0, unit: "%",  min: 0, max: 100        },
      { name: "soc",               startByte: 5, length: 1, signed: false, factor: 1, offset: 0, unit: "%",  min: 0, max: 100        },
    ]
  },
};

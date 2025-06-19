import type { CharacteristicValue, PlatformAccessory } from 'homebridge'

import type { SmartHQPlatform } from '../platform.js'
import type { devicesConfig, SmartHqContext } from '../settings.js'

// import { Buffer } from 'node:buffer'
import axios from 'axios'

import { ERD_TYPES } from '../settings.js'
import { deviceBase } from './device.js'

// enum AirConditionerMode {
//   Cool = 'cool',
//   Dry = 'dry',
//   Heat = 'heat',
//   Fan = 'Fan',
// }
//
// enum TemperatureUnit {
//   Celsius = 'C',
//   Farenheit = 'F',
// }
//
// enum FanMode {
//   Auto = 'auto',
//   Low = 'low',
//   Medium = 'medium',
//   High = 'high',
//   Turbo = 'turbo',
// }
//
// enum FanOscillationMode {
//   All = 'all',
//   Fixed = 'fixed',
//   Vertical = 'vertical',
// }
//
// enum SwitchState {
//   On = 'on',
//   Off = 'off',
// }
//
// enum OptionalMode {
//   Off = 'off',
//   Sleep = 'sleep',
//   Speed = 'speed',
//   WindFree = 'windFree',
//   WindFreeSleep = 'windFreeSleep',
// }
/**
 * Onboard settings:
 * Power States: ON|OFF
 * Mode States: COOL|FAN|DRY|HEAT
 * Fan Speeds: LOW|MED|HIGH
 * TEMP SETTING: ??
 * TIMER: ??
 * SLEEP: ??
 * AUTOSWING: ??
 * Portable AC Features:
 * [
 *     {
 *         "erd": "0x7003",
 *         "name": "Target Cooling Temperature",
 *         "length": 2
 *     },
 *     {
 *         "erd": "0x7A00",
 *         "name": "WAC Fan Setting",
 *         "length": 1
 *     },
 *     {
 *         "erd": "0x7A01",
 *         "name": "WAC Operation Mode",
 *         "length": 1
 *     },
 *     {
 *         "erd": "0x7A02",
 *         "name": "WAC Ambient Temperature",
 *         "length": 1
 *     },
 *     {
 *         "erd": "0x7A0F",
 *         "name": "WAC Power On/Off State",
 *         "length": 1
 *     },
 *     {
 *         "erd": "0x7B00",
 *         "name": "Available AC Modes",
 *         "length": 1
 *     },
 *     {
 *         "erd": "0x7B0B",
 *         "name": "Available AC Fan Speeds",
 *         "length": 1
 *     }
 * ]
 */

export class SmartHQPortableAC extends deviceBase {
  private ACPowerServiceName = 'AC Power'
  private ACTempSensorServiceName = 'AC Temperature Sensor'

  constructor(
    readonly platform: SmartHQPlatform,
    accessory: PlatformAccessory<SmartHqContext>,
    readonly device: SmartHqContext['device'] & devicesConfig,
  ) {
    super(platform, accessory, device)

    this.debugLog(`Portable AC Features: ${JSON.stringify(accessory.context.device.features)}`)

    const PortableACPowerService = this.accessory.getService(this.hap.Service.HeaterCooler) || this.accessory.addService(this.hap.Service.HeaterCooler, this.ACPowerServiceName)

    PortableACPowerService
      .getCharacteristic(this.platform.Characteristic.Active)
      .onGet(() => this.readErd(ERD_TYPES.AC_POWER_STATE))
      .onSet(value => this.writeErd(ERD_TYPES.AC_POWER_STATE, value))

    PortableACPowerService
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(() => this.readErd(ERD_TYPES.AC_WAC_OP_MODE))
    // PortableACPowerService.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
    //   .onGet(() => this.readErd(ERD_TYPES.AC_WAC_OP_MODE))
    //
    // PortableACPowerService.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
    //   .onGet(this.handleTargetHeaterCoolerStateGet.bind(this))
    //   .onSet(this.handleTargetHeaterCoolerStateSet.bind(this))
    // PortableACPowerService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
    //   .onGet(this.handleCurrentTemperatureGet.bind(this))
    //
    // PortableACPowerService.getCharacteristic(this.platform.Characteristic.SwingMode)
    //   .onGet(this.handleSwingModeGet.bind(this))
    //   .onSet(this.handleSwingModeSet.bind(this))
  }
  //
  // private async getProductionValue(): Promise<number> {
  //   try {
  //     const erdVal = await this.readErd(ERD_TYPES.OIM_PRODUCTION)
  //     const hexToIntVal = Buffer.from(erdVal, 'hex').readUInt8(0)
  //     const productionValue = Math.min(hexToIntVal, 100)
  //     const completionistMsg = hexToIntVal > 100 ? `, Completion: ${hexToIntVal}` : ''
  //     this.debugSuccessLog(`Progress Svc: Value: ${productionValue}, Limit: ${this.opalProductionLimit}${completionistMsg}`)
  //     return productionValue
  //   } catch (error) {
  //     const typedErr = error as { message: string }
  //     this.errorLog(`Failed to read production value: ${typedErr.message}`)
  //     // Default to 0 if there's an error
  //     return 0
  //   }
  // }

  async readErd(erd: string): Promise<string> {
    const d = await axios
      .get(`/appliance/${this.accessory.context.device.applianceId}/erd/${erd}`)
    return String(d.data.value)
  }

  async writeErd(erd: string, value: string | boolean | CharacteristicValue) {
    await axios
      .post(`/appliance/${this.accessory.context.device.applianceId}/erd/${erd}`, {
        kind: 'appliance#erdListEntry',
        userId: this.accessory.context.userId,
        applianceId: this.accessory.context.device.applianceId,
        erd,
        value: typeof value === 'boolean' ? (value ? '01' : '00') : value,
      })
    return undefined
  }
}

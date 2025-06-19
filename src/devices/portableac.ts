import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge'

import type { SmartHQPlatform } from '../platform.js'
import type { devicesConfig, SmartHqContext } from '../settings.js'

import axios from 'axios'

import { deviceBase } from './device.js'

const POWER_ERD = '0x7A0F'
const TEMP_SETPOINT_ERD = '0x7003'
const FAN_SPEED_ERD = '0x7A00'
const AMBIENT_TEMP_ERD = '0x7A02'

export class SmartHQPortableAC extends deviceBase {
  private ACPowerServiceName = 'AC Power'
  private ACTempSensorServiceName = 'AC Temperature Sensor'
  private service: Service
  private fanService?: Service

  constructor(
    readonly platform: SmartHQPlatform,
    accessory: PlatformAccessory<SmartHqContext>,
    readonly device: SmartHqContext['device'] & devicesConfig,
  ) {
    super(platform, accessory, device)

    this.debugLog(`Portable AC Features: ${JSON.stringify(accessory.context.device.features)}`)
    this.service = this.accessory.getService(this.hap.Service.HeaterCooler)
      || this.accessory.addService(this.hap.Service.HeaterCooler)

    this.service.setCharacteristic(this.hap.Characteristic.Name, 'Portable A/C')

    this.setupPowerHandlers(this.hap.Characteristic)
    this.setupTempHandlers(this.hap.Characteristic)
    this.setupFanSpeedHandlers(this.hap.Characteristic)

    this.fanService = this.accessory.getService(this.hap.Service.Fan)
      || this.accessory.addService(this.hap.Service.Fan)
    this.setupFanService(this.hap.Characteristic)
  }

  private setupPowerHandlers(Characteristic: typeof this.platform.Characteristic) {
    this.service.getCharacteristic(Characteristic.Active)
      .onGet(async () => {
        const isOn = await this.isOn()
        return isOn ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE
      })
      .onSet(async (value) => {
        if (value === Characteristic.Active.ACTIVE) {
          await this.turnOn()
        } else {
          await this.turnOff()
        }
      })
  }

  private setupTempHandlers(Characteristic: typeof this.platform.Characteristic) {
    this.service.getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(async () => {
        return await this.getAmbientTemperature()
      })

    this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .setProps({ minValue: 60, maxValue: 86, minStep: 1 })
      .onGet(async () => {
        return await this.getTemperature()
      })
      .onSet(async (value) => {
        await this.setTemperature(value as number)
      })
  }

  private setupFanSpeedHandlers(Characteristic: typeof this.platform.Characteristic) {
    this.service.getCharacteristic(Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 3, minStep: 1 })
      .onGet(async () => {
        const speed = await this.getFanSpeed()
        return { low: 0, medium: 1, high: 2, auto: 3 }[speed]
      })
      .onSet(async (value) => {
        const levels = ['low', 'medium', 'high', 'auto'] as const
        await this.setFanSpeed(levels[value as number] ?? 'low')
      })
  }

  private setupFanService(Characteristic: typeof this.platform.Characteristic) {
    if (!this.fanService) {
      return
    }

    this.fanService.getCharacteristic(Characteristic.On)
      .onGet(async () => {
        return await this.isOn()
      })
      .onSet(async (value) => {
        if (value) {
          await this.turnOn()
        } else {
          await this.turnOff()
        }
      })

    this.fanService.getCharacteristic(Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 3, minStep: 1 })
      .onGet(async () => {
        const speed = await this.getFanSpeed()
        return { low: 0, medium: 1, high: 2, auto: 3 }[speed]
      })
      .onSet(async (value) => {
        const levels = ['low', 'medium', 'high', 'auto'] as const
        await this.setFanSpeed(levels[value as number] ?? 'low')
      })
  }

  async readErd(erd: string): Promise<number> {
    const res = await axios.get(`/appliance/${this.accessory.context.device.applianceId}/erd/${erd}`)
    return Number.parseInt(res.data.value, 16)
  }

  async writeErd(erd: string, value: string | number | boolean | CharacteristicValue) {
    await axios.post(`/appliance/${this.accessory.context.device.applianceId}/erd/${erd}`, {
      kind: 'appliance#erdListEntry',
      userId: this.accessory.context.userId,
      applianceId: this.accessory.context.device.applianceId,
      erd,
      value: typeof value === 'boolean'
        ? (value ? '01' : '00')
        : typeof value === 'number'
          ? value.toString(16).padStart(2, '0')
          : value,
    })
  }

  async turnOn() {
    await this.writeErd(POWER_ERD, 1)
  }

  async turnOff() {
    await this.writeErd(POWER_ERD, 0)
  }

  async isOn(): Promise<boolean> {
    return (await this.readErd(POWER_ERD)) === 1
  }

  async setTemperature(tempF: number): Promise<void> {
    await this.writeErd(TEMP_SETPOINT_ERD, tempF)
  }

  async getTemperature(): Promise<number> {
    return await this.readErd(TEMP_SETPOINT_ERD)
  }

  async setFanSpeed(speed: 'low' | 'medium' | 'high' | 'auto'): Promise<void> {
    const map = { low: 0, medium: 1, high: 2, auto: 3 }
    await this.writeErd(FAN_SPEED_ERD, map[speed])
  }

  async getFanSpeed(): Promise<'low' | 'medium' | 'high' | 'auto'> {
    const reverseMap = ['low', 'medium', 'high', 'auto'] as const
    const val = await this.readErd(FAN_SPEED_ERD)
    return reverseMap[val] ?? 'low'
  }

  async getAmbientTemperature(): Promise<number> {
    return await this.readErd(AMBIENT_TEMP_ERD)
  }
}

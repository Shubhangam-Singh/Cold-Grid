/** A single live sensor reading from the PPSC cart via the hardware bridge. */
export interface SensorReading {
  /** Temperature, °C (DHT22). */
  tempC: number;
  /** Relative humidity, % (DHT22). */
  humidity: number;
  /** Gas / VOC index (MQ-135). */
  gas: number;
  /** Unix seconds when the reading was taken. */
  at: number;
}

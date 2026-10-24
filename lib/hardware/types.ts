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
  /** Produce name from the cart JSON (`Fish`, `Tomato`, …), when the frame has one. */
  produce?: string;
  /** On-device freshness 0–100, when the cart sent it. */
  freshness?: number;
  /** On-device sell price, rupees, when the cart sent it. */
  price?: number;
  /** On-device degradation rate (× vs reference), when the cart sent it. */
  rate?: number;
  /** On-device thermal-memory EMA, when the cart sent it. */
  thermalEMA?: number;
  /** On-device hours of shelf life left, when the cart sent it. */
  hoursRemaining?: number;
  /** Cart flagged a temperature spike. */
  spike?: boolean;
  /** Cart flagged the load as expired. */
  expired?: boolean;
}

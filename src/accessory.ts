import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";


const midi = require('midi');
let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("ExampleStatelessSwitch", ExampleStatelessSwitch);
};

class ExampleStatelessSwitch implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;

  private readonly sequence: number[];
  private buffer: number[] = [];

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;

    this.name = config.name;
    this.sequence = config.sequence;
    log.info(this.sequence.toString());

    this.switchService = new hap.Service.StatelessProgrammableSwitch(this.name);

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Custom Manufacturer")
      .setCharacteristic(hap.Characteristic.Model, "Custom Model");

    log.info("Switch finished initializing!");

    // Midi


    const input = new midi.Input();

    log.info(input.getPortCount());
    log.info(input.getPortName(1));

    input.on('message', (deltaTime: number, message: number[]) => {
      // The message is an array of numbers corresponding to the MIDI bytes:
      //   [status, data1, data2]
      // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
      // information interpreting the messages.
      log.info(`m: ${message} d: ${deltaTime}`);

      if (message[0] == 144) {
        this.buffer.push(message[1]);
      }

      // console.log(buffer);
      this.checkBuffer();
    });

    input.openPort(1);

  }

  checkBuffer() {
    if (this.buffer.length >= this.sequence.length) {
      let match = true;

      for (let i = 0; i < this.sequence.length; i++) {
        let sequenceIndex = this.sequence.length - 1 - i;
        let bufferIndex = this.buffer.length - 1 - i;

        if (this.buffer[bufferIndex] != this.sequence[sequenceIndex]) {
          match = false;
          break;
        }
      }

      if (match) {
        console.log("Match found: " + this.name);
        this.buffer = [];
        this.switchService.setCharacteristic(hap.Characteristic.ProgrammableSwitchEvent, 0);
      } else {
        console.log("No match: " + this.name);
      }

    }
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }

}

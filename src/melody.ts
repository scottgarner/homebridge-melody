import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  Service,
  PlatformConfig,
  StaticPlatformPlugin,
  Access
} from "homebridge";

interface MelodyConfig extends AccessoryConfig {
  sequence: number[];
}

interface MelodyPlatformConfig extends PlatformConfig {
  port?: number
}

const midi = require('midi');
let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerPlatform("MelodyPlatform", MelodyPlatform);
};

class MelodyPlatform implements StaticPlatformPlugin {

  private readonly log: Logging;
  private readonly config: MelodyPlatformConfig;
  private readonly melodyAccessories: MelodyAccessory[] = [];

  private buffer: number[] = [];

  constructor(log: Logging, config: MelodyPlatformConfig, api: API) {
    this.log = log;
    this.config = config;

    const port: number | undefined = config.port;

    // MIDI out setup.
    const output = new midi.Output();
    if (config.port != undefined) {
      const count = output.getPortCount();
      log.info("Available MIDI output ports: " + output.getPortCount());
      for (let i = 0; i < count; i++) {
        let name = output.getPortName(i);
        log.info(i.toString(), name);
      }
      output.openPort(config.port);
    }

    const input = new midi.Input();
    // MIDI in setup.
    {

      log.info("Available MIDI ports: " + input.getPortCount());
      log.info(input.getPortName(1));

      input.on('message', (deltaTime: number, message: number[]) => {
        // Push "note on" messages into the buffer.
        if (message[0] == 144) this.buffer.push(message[1]);
        // Check the buffer for matches.
        this.checkBuffer();

        // Send to output.
        if (output.isPortOpen()) {
          output.sendMessage(message);
        }
      });

      input.openPort(1);
    }
  }

  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {

    let index: number = 0;
    this.config.accessories.forEach((accessoryData: MelodyConfig) => {
      this.log.info(JSON.stringify(accessoryData));
      this.melodyAccessories.push(new MelodyAccessory(this.log, accessoryData, index++));
    });

    callback(<AccessoryPlugin[]>this.melodyAccessories);
  }

  checkBuffer() {
    this.melodyAccessories.every((melodyAccessory) => {
      // Try to match the sequence.
      if (this.buffer.length >= melodyAccessory.melodyData.sequence.length) {
        let match = true;
        let sequence = melodyAccessory.melodyData.sequence;
        let name = melodyAccessory.melodyData.name;

        for (let i = 0; i < sequence.length; i++) {
          let sequenceIndex = sequence.length - 1 - i;
          let bufferIndex = this.buffer.length - 1 - i;

          if (this.buffer[bufferIndex] != sequence[sequenceIndex]) {
            match = false;
            break;
          }
        }

        if (match) {
          this.log.info("Match found: " + name);
          this.buffer = [];
          melodyAccessory.trigger();
          return false; // break;
        } else {
          // console.log("No match: " + name);
          return true;// continue;
        }

      }
    })

    // Trim buffer.
    if (this.buffer.length > 64) {
      this.buffer = this.buffer.slice(-64)
    }
  }
}

class MelodyAccessory implements AccessoryPlugin {

  public readonly name: string;

  private readonly log: Logging;
  public readonly melodyData: MelodyConfig;

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, melodyConfig: MelodyConfig, index: number) {
    // Homebridge setup.
    {
      this.log = log;
      this.melodyData = melodyConfig;
      this.name = this.melodyData.name;

      log.info("New melody: " + this.melodyData.name);
      this.switchService = new hap.Service.StatelessProgrammableSwitch(this.melodyData.name);

      this.switchService.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent)
        .setProps({
          validValues: [hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS]
        });

      this.switchService.setCharacteristic(hap.Characteristic.ServiceLabelIndex, index + 1);

      this.informationService = new hap.Service.AccessoryInformation();

    }
  }

  trigger() {
    this.log.info("Trigger single press!");
    //   this.switchService.setCharacteristic(
    // hap.Characteristic.ProgrammableSwitchEvent, 
    // hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
    //   );
    this.switchService.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent)
      .setValue(hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS)
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }
}

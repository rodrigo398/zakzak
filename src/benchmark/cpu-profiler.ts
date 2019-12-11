/*!
 * Copyright 2019, Dynatrace LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import inspector from "inspector";

const session = new inspector.Session();
session.connect();

export default class CpuProfiler {
  static enable() {
    return new Promise((res, err) => {
      session.post("Profiler.enable", error => {
        if (error) {
          err(error);
        } else {
          res();
        }
      });
    });
  }

  static start() {
    return new Promise((res, err) => {
      session.post("Profiler.start", error => {
        if (error) {
          err(error);
        } else {
          res();
        }
      });
    });
  }

  static stop() {
    return new Promise<inspector.Profiler.Profile>((res, err) => {
      session.post("Profiler.stop", (error, { profile }) => {
        if (error) {
          err(error);
        } else {
          res(profile);
        }
      });
    });
  }

  static setSamplingInterval(micros: number) {
    return new Promise<inspector.Profiler.Profile>((res, err) => {
      session.post("Profiler.setSamplingInterval", { interval: micros }, error => {
        if (error) {
          err(error);
        } else {
          res();
        }
      });
    });
  }

  static async profileFunction(fn: Function, repeatCount: number, interval: number) {
    await this.enable();
    await this.setSamplingInterval(interval);
    await this.start();
    for (let i = 0; i < repeatCount; i++) {
      fn();
    }
    return this.stop();
  }
}

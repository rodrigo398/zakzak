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

import v8 from "v8";
import vm from "vm";

/**
 * Wrapper class for the garbage collector
 */
export default class GarbageCollector {
  /**
   * Store the exposed `gc` function
   */
  private static gc = () => {
    console.error("no gc registered");
  };

  /**
   * Init the wrapper by setting the flags to expose the garbage collector and saving it in the class property
   */
  static init() {
    v8.setFlagsFromString("--expose_gc");
    const gc = vm.runInNewContext("gc");
    if (typeof gc === "function") {
      GarbageCollector.gc = gc;
    }
  }

  /**
   * Collect garbage
   */
  public static collect() {
    this.gc();
  }
}

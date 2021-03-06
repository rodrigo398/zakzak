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

import { writeFileSync } from "fs";
import { js2xml } from "xml-js";
import { Exporter } from "../exporter";
import { BenchmarkResult } from "../../benchmark";

export default class XmlExporter extends Exporter {
  public onFinished(results: BenchmarkResult[]): void {
    // Dont remove compact statement
    // https://github.com/nashwaan/xml-js/issues/60
    const xmlString = js2xml(results, { compact: true });
    writeFileSync("benchmark.data.xml", xmlString);
  }
}

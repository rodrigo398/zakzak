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
import { replace } from "lodash";
import { Exporter } from "../exporter";
import { BenchmarkResult } from "../../benchmark";
import convertToD3FlameGraph from "../../util/cpu-profile-converter";

export default class D3FlameGraphExporter extends Exporter {
  public onResult(result: BenchmarkResult) {
    if (result.cpuProfile) {
      const root = convertToD3FlameGraph(result.cpuProfile);
      let html = `
      <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/spiermar/d3-flame-graph@2.0.3/dist/d3-flamegraph.css">
      <div id="chart"></div>
      <script type="text/javascript" src="https://d3js.org/d3.v4.min.js"></script>
      <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/d3-tip/0.9.1/d3-tip.min.js"></script>
      <script type="text/javascript" src="https://cdn.jsdelivr.net/gh/spiermar/d3-flame-graph@2.0.3/dist/d3-flamegraph.min.js"></script>
      <script>
      var data = #data#;
      
      var flamegraph = d3.flamegraph()
          .width(960);
          flamegraph.selfValue(true)
      
       d3.select("#chart")
          .datum(data)
          .call(flamegraph);
      </script>
      `;

      html = html.replace("#data#", JSON.stringify(root));
      writeFileSync(`${replace(result.name, " ", "-")}.profile.html`, html);
    }
  }
}

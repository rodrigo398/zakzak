
// shebang.js will insert a shebang somewhere above this comment
// shebang hack: http://sambal.org/2014/02/passing-options-node-shebang-line/
// shebang has to be inserted after transpilation, otherwise tsc will insert semicolons between ":" and //
// which would make it no longer work
import BenchmarkManager from "../manager/benchmark-manager";
import CLIManager from "./cli-manager";
import { ConsoleExporter } from "../manager/exporter";
import { JsonExporter } from "../manager/exporter";
import OptionsManager from "../config/options-manager";

const cli = new CLIManager();
const files = cli.getFiles();

OptionsManager.overrideConsole();
cli.printHeader();





BenchmarkManager
	.getInstance()
	.addExporter(new ConsoleExporter(), new JsonExporter())
	.readFiles(files)
	.run();


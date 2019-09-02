import process from "process";
import _ from "lodash";
import v8natives from "v8-natives";
import { calculateMedian, calculateMarginOfError, calculateStandardError, isWithin } from "@util";
import { BenchmarkOptions } from "@zakzak/config/options";
import "@zakzak/logging";
import TimeUnit from "@timeunit";

/**
 * Benchmark is responsible for the actual benchmarking.
 * It measures the times, warms the v8 up, saves and interpretes results
 */
export default class Benchmark {

	public id: string;

	public constructor(
		name: string,
		fn: Function,
		filename?: string,
		options: BenchmarkOptions = {}
	) {
		zak.debug(`creating new benchmark ${name}`);
		this.name = name;
		this.fn = fn;
		if (filename) {
			this.filename = filename;
		}
		this.options = options;
		this.startTime = 0;
		this.endTime = 0;
		this.currentTry = 0;
	}

	public run() {
		this.startTime = getTime();
		zak.debug(`running benchmark ${this.name}`);
		if (!this.options.warmup.allowJIT) {
			const fn = this.fn;
			zak.debug("wrapping function and disabling optimization for it");
			const neverOptimize = () => { fn(); };
			v8natives.neverOptimizeFunction(neverOptimize);
			this.fn = neverOptimize;
		}

		zak.debug("starting core part of the benchmark");
		this.currentTry = 0;
		do {
			this.currentTry++;
			this.warmup = this.getWarmup();
			this.overhead = this.getOverhead();
			this.results = this.getMeasurement();
			if (this.options.overhead.enable) {
				this.deductOverhead();
			}
		} while (!this.areResultsAcceptable() && !this.isMaxTriesReached(this.currentTry));

		zak.debug(`finished benchmark ${this.name}`);
		this.endTime = getTime();
		return this.results;
	}

	public name: string;
	public filename: string;
	public results: MeasurementResult;
	public options: BenchmarkOptions;
	public fn: Function;
	public warmup: number;
	public overhead: number;
	public startTime: number;
	public endTime: number;
	public currentTry: number;

	private getWarmup() {
		if (!this.options.warmup.enable) {
			zak.debug("warmup 1 due to warmup disabled in options");
			return 1;
		}

		zak.debug("starting warmup estimation process");
		let count = 0;
		let times: number[] = [];
		const increaseFactor = this.options.warmup.increaseFactor;
		const startTime = getTime();
		do {
			count++;
			const a = getTime();
			this.fn();
			times.push(getTime() - a);
			if (count % increaseFactor === 0) {
				const marginOfError = calculateMarginOfError(times, 99.9);
				const median = calculateMedian(times);
				const mean = _.mean(times);
				const acceptable = marginOfError <= (mean * 0.1) && isWithin(median, mean, 0.1);
				if (acceptable) {
					this.warmup = count;
					break;
				}
				times = [];
			}
		} while ((getTime() - startTime) < this.options.warmup.maxTime);

		return count;
	}

	private getOverhead() {
		zak.debug("measuring benchmarking overhead");
		// tslint:disable-next-line: no-empty
		return this.getMeasurement(() => { }).mean;
	}

	private deductOverhead() {
		zak.debug("deducting calculated overhead from results");
		this.results.max -= this.overhead;
		this.results.mean -= this.overhead;
		this.results.median -= this.overhead;
		this.results.min -= this.overhead;
		this.results.times.map((t) => t - this.overhead);
	}

	private getMeasurement(fn = this.fn): MeasurementResult {
		zak.debug("starting measurement");
		let times = [];
		let warmup = this.warmup;
		v8natives.optimizeFunctionOnNextCall(fn);
		while (warmup--) {
			fn();
		}

		let cycles = this.options.measure.cycles;
		while (cycles--) {
			let inner = this.warmup;
			times.push(getTime());
			while (inner--) {
				fn();
			}
			times.push(getTime());
		}

		const actualTimes = [];
		for (let i = 0, l = times.length; i < l; i += 2) {
			actualTimes.push((times[i + 1] - times[i]) / this.warmup);
		}
		times = actualTimes;

		zak.debug("finished measurement");

		return {
			marginOfError: calculateMarginOfError(times, 99.9),
			min: _.min(times),
			max: _.max(times),
			median: calculateMedian(times),
			standardError: calculateStandardError(times),
			mean: _.mean(times),
			times: this.options.measure.saveTimes === true ? times : []
		};
	}

	private areResultsAcceptable(results: MeasurementResult = this.results) {
		zak.debug("checking if measurement results are acceptable");
		const acceptable = results.marginOfError <= (results.mean * 0.1) && isWithin(results.median, results.mean, 0.1);
		if (!acceptable) {
			zak.debug("measurement results not acceptable");
		}
		return acceptable;
	}

	private isMaxTriesReached(currentTry: number) {
		zak.debug("checking maxtries limit");
		const reached = currentTry >= this.options.maxTries;
		if (reached) {
			zak.debug("max tries has been reached");
		}
		return reached;
	}
}

/**
 * Gets the current time using process.hrtime
 * @returns A timestamp in nanoseconds
 */
function getTime(): number {
	const time = process.hrtime();
	return time[0] * 1e9 + time[1];
}

export interface MeasurementResult {
	marginOfError?: number;
	min?: number;
	max?: number;
	median?: number;
	standardError?: number;
	mean?: number;
	times?: number[];
}

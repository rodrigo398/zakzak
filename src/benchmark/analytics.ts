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

import _ from "lodash";

/**
 * Analytics contains the mathematical calculations to perform analysis on a batch of data
 */
export class Analytics {
  /**
   * Calculates the minimum size a measurement has to have,
   * in order to reduce the uncertainty to a specified fraction of the measurement
   * @param smallestMeasure The smallest possible measure
   * @param fractionOfUncertainty The fraction of uncertainty, which a measurement should have
   * @example
   * // 5% uncertainy with smallest measure 20 ns
   * let measure = reduceUncertainty(20, 0.05);
   */
  public static reduceUncertainty(smallestMeasure: number, fractionOfUncertainty: number) {
    const uncertainty = smallestMeasure / 2;
    return uncertainty / fractionOfUncertainty;
  }

  /**
   * Calculates a list of metrics and statistical values for a batch of samples
   * @param samples The samples
   */
  public static getFullAnalysis(samples: number[]): FullAnalysis {
    return {
      min: Analytics.getMin(samples),
      max: Analytics.getMax(samples),
      marginOfError: Analytics.getMarginOfError(samples),
      standardDeviation: Analytics.getStandardDeviation(samples),
      standardError: Analytics.getStandardError(samples),
      mean: Analytics.getMean(samples),
      mode: Analytics.getMode(samples),
      median: Analytics.getMedian(samples),
    };
  }

  /**
   * Gets the smallest value from a list of samples
   * @param samples The samples
   */
  public static getMin(samples: number[]) {
    return _.min(samples);
  }

  /**
   * Gets the biggest value from a list of samples
   * @param samples The samples
   */
  public static getMax(samples: number[]) {
    return _.max(samples);
  }

  /**
   * Calculates the [margin of error](https://www.statisticshowto.datasciencecentral.com/probability-and-statistics/hypothesis-testing/margin-of-error/)
   * from a batch of samples using the [Sample Standard Error](https://www.radford.edu/~biol-web/stats/standarderrorcalc.pdf)
   * and the [T-Score](http://www.sjsu.edu/faculty/gerstman/StatPrimer/t-table.pdf) inferred from the confidence level
   * @param samples The batch of samples
   * @param confidence Level of confidence for the margin of error as percent from 0 to 99.9
   */
  public static getMarginOfError(samples: number[], confidence: ConfidenceLevel = 99) {
    const standardError = Analytics.getStandardError(samples);
    const tScore = Analytics.getTScore(samples, confidence);
    const moe = standardError * tScore;

    return moe;
  }

  /**
   * Calculates the [Standard Deviation](https://www.radford.edu/~biol-web/stats/standarderrorcalc.pdf) for a batch of samples
   * @param samples The batch of samples
   */
  public static getStandardDeviation(samples: number[]) {
    const mean = Analytics.getMean(samples);
    const squaredDeviations = _.sumBy(samples, s => (s - mean) ** 2);
    const standardDeviation = Math.sqrt(squaredDeviations / (samples.length - 1));

    return standardDeviation;
  }

  /**
   * Calculates the [Sample Standard Error](https://www.radford.edu/~biol-web/stats/standarderrorcalc.pdf) for a batch of samples
   * @param samples The samples
   */
  public static getStandardError(samples: number[]) {
    const standardError = Analytics.getStandardDeviation(samples) / samples.length;
    return standardError;
  }

  /**
   * Calculates the mean for a batch of samples
   * @param samples The samples
   */
  public static getMean(samples: number[]) {
    return _.mean(samples);
  }

  /**
   * Calculates the [mode](https://en.wikipedia.org/wiki/Mode_(statistics)) for a batch of samples.
   * The mode is the most common value in a list of numbers.
   * Floating point values will be rounded, as the mode can only be calculated for integers.
   * Especially useful with small measurements.
   * @param samples The samples
   */
  public static getMode(samples: number[]) {
    const rounded = samples.map(value => Math.round(value));
    const grouped = _.groupBy(rounded);
    const pairs = _.toPairs(grouped);
    const max = _.maxBy(pairs, p => p[1].length);
    return max[1][0];
  }

  /**
   * Calculates the median for a batch of samples
   * @param samples The samples
   */
  public static getMedian(samples: number[]) {
    const sorted = _.orderBy(samples);
    if (sorted.length % 2 === 0) {
      // array with even number elements
      return (sorted[sorted.length / 2] + sorted[sorted.length / 2 - 1]) / 2;
    }
    return sorted[(sorted.length - 1) / 2]; // array with odd number elements
  }

  /**
   * Returns the t-score for a batch of samples and confidence level, by using a table of t-scores
   * @param samples Batch of samples for which the t-score is calculated
   * @param confidence The confidence level for the t-score
   */
  private static getTScore(samples: number[], confidence: ConfidenceLevel) {
    const confidenceLevels = [0, 50, 60, 70, 80, 90, 95, 98, 99, 99.8, 99.9];
    const confidenceIndex = confidenceLevels.indexOf(confidence);
    const df = samples.length - 1;
    for (let i = 0, l = Analytics.tTable.length - 1; i < l; i++) {
      if (Analytics.tTable[i].df >= df) {
        return Analytics.tTable[i].tValues[confidenceIndex];
      }
    }
    return 0;
  }

  /**
   * Table containing t-scores, ordered by degrees of freedom and then by confidence level
   */
  private static tTable = [
    {
      df: 1,
      tValues: [0.0, 1.0, 1.376, 1.963, 3.078, 6.314, 12.71, 31.82, 63.66, 318.31, 636.62],
    },
    {
      df: 2,
      tValues: [0.0, 0.816, 1.061, 1.386, 1.886, 2.92, 4.303, 6.965, 9.925, 22.327, 31.599],
    },
    {
      df: 3,
      tValues: [0.0, 0.765, 0.978, 1.25, 1.638, 2.353, 3.182, 4.541, 5.841, 10.215, 12.924],
    },
    {
      df: 4,
      tValues: [0.0, 0.741, 0.941, 1.19, 1.533, 2.132, 2.776, 3.747, 4.604, 7.173, 8.61],
    },
    {
      df: 5,
      tValues: [0.0, 0.727, 0.92, 1.156, 1.476, 2.015, 2.571, 3.365, 4.032, 5.893, 6.869],
    },
    {
      df: 6,
      tValues: [0.0, 0.718, 0.906, 1.134, 1.44, 1.943, 2.447, 3.143, 3.707, 5.208, 5.959],
    },
    {
      df: 7,
      tValues: [0.0, 0.711, 0.896, 1.119, 1.415, 1.895, 2.365, 2.998, 3.499, 4.785, 5.408],
    },
    {
      df: 8,
      tValues: [0.0, 0.706, 0.889, 1.108, 1.397, 1.86, 2.306, 2.896, 3.355, 4.501, 5.041],
    },
    {
      df: 9,
      tValues: [0.0, 0.703, 0.883, 1.1, 1.383, 1.833, 2.262, 2.821, 3.25, 4.297, 4.781],
    },
    {
      df: 10,
      tValues: [0.0, 0.7, 0.879, 1.093, 1.372, 1.812, 2.228, 2.764, 3.169, 4.144, 4.587],
    },
    {
      df: 11,
      tValues: [0.0, 0.697, 0.876, 1.088, 1.363, 1.796, 2.201, 2.718, 3.106, 4.025, 4.437],
    },
    {
      df: 12,
      tValues: [0.0, 0.695, 0.873, 1.083, 1.356, 1.782, 2.179, 2.681, 3.055, 3.93, 4.318],
    },
    {
      df: 13,
      tValues: [0.0, 0.694, 0.87, 1.079, 1.35, 1.771, 2.16, 2.65, 3.012, 3.852, 4.221],
    },
    {
      df: 14,
      tValues: [0.0, 0.692, 0.868, 1.076, 1.345, 1.761, 2.145, 2.624, 2.977, 3.787, 4.14],
    },
    {
      df: 15,
      tValues: [0.0, 0.691, 0.866, 1.074, 1.341, 1.753, 2.131, 2.602, 2.947, 3.733, 4.073],
    },
    {
      df: 16,
      tValues: [0.0, 0.69, 0.865, 1.071, 1.337, 1.746, 2.12, 2.583, 2.921, 3.686, 4.015],
    },
    {
      df: 17,
      tValues: [0.0, 0.689, 0.863, 1.069, 1.333, 1.74, 2.11, 2.567, 2.898, 3.646, 3.965],
    },
    {
      df: 18,
      tValues: [0.0, 0.688, 0.862, 1.067, 1.33, 1.734, 2.101, 2.552, 2.878, 3.61, 3.922],
    },
    {
      df: 19,
      tValues: [0.0, 0.688, 0.861, 1.066, 1.328, 1.729, 2.093, 2.539, 2.861, 3.579, 3.883],
    },
    {
      df: 20,
      tValues: [0.0, 0.687, 0.86, 1.064, 1.325, 1.725, 2.086, 2.528, 2.845, 3.552, 3.85],
    },
    {
      df: 21,
      tValues: [0.0, 0.686, 0.859, 1.063, 1.323, 1.721, 2.08, 2.518, 2.831, 3.527, 3.819],
    },
    {
      df: 22,
      tValues: [0.0, 0.686, 0.858, 1.061, 1.321, 1.717, 2.074, 2.508, 2.819, 3.505, 3.792],
    },
    {
      df: 23,
      tValues: [0.0, 0.685, 0.858, 1.06, 1.319, 1.714, 2.069, 2.5, 2.807, 3.485, 3.768],
    },
    {
      df: 24,
      tValues: [0.0, 0.685, 0.857, 1.059, 1.318, 1.711, 2.064, 2.492, 2.797, 3.467, 3.745],
    },
    {
      df: 25,
      tValues: [0.0, 0.684, 0.856, 1.058, 1.316, 1.708, 2.06, 2.485, 2.787, 3.45, 3.725],
    },
    {
      df: 26,
      tValues: [0.0, 0.684, 0.856, 1.058, 1.315, 1.706, 2.056, 2.479, 2.779, 3.435, 3.707],
    },
    {
      df: 27,
      tValues: [0.0, 0.684, 0.855, 1.057, 1.314, 1.703, 2.052, 2.473, 2.771, 3.421, 3.69],
    },
    {
      df: 28,
      tValues: [0.0, 0.683, 0.855, 1.056, 1.313, 1.701, 2.048, 2.467, 2.763, 3.408, 3.674],
    },
    {
      df: 29,
      tValues: [0.0, 0.683, 0.854, 1.055, 1.311, 1.699, 2.045, 2.462, 2.756, 3.396, 3.659],
    },
    {
      df: 30,
      tValues: [0.0, 0.683, 0.854, 1.055, 1.31, 1.697, 2.042, 2.457, 2.75, 3.385, 3.646],
    },
    {
      df: 40,
      tValues: [0.0, 0.681, 0.851, 1.05, 1.303, 1.684, 2.021, 2.423, 2.704, 3.307, 3.551],
    },
    {
      df: 60,
      tValues: [0.0, 0.679, 0.848, 1.045, 1.296, 1.671, 2.0, 2.39, 2.66, 3.232, 3.46],
    },
    {
      df: 80,
      tValues: [0.0, 0.678, 0.846, 1.043, 1.292, 1.664, 1.99, 2.374, 2.639, 3.195, 3.416],
    },
    {
      df: 100,
      tValues: [0.0, 0.677, 0.845, 1.042, 1.29, 1.66, 1.984, 2.364, 2.626, 3.174, 3.39],
    },
    {
      df: 1000,
      tValues: [0.0, 0.675, 0.842, 1.037, 1.282, 1.646, 1.962, 2.33, 2.581, 3.098, 3.3],
    },
    {
      df: Infinity,
      tValues: [0.0, 0.674, 0.842, 1.036, 1.282, 1.645, 1.96, 2.326, 2.576, 3.09, 3.291],
    },
  ];
}

/**
 * Possible confidence levels
 */
type ConfidenceLevel = 0 | 50 | 60 | 70 | 80 | 90 | 95 | 98 | 99 | 99.8 | 99.9;

/**
 * Result of a full analysis
 */
interface FullAnalysis {
  min: number;
  max: number;
  marginOfError: number;
  standardDeviation: number;
  standardError: number;
  mean: number;
  mode: number;
  median: number;
}

// Export has to be done this way, otherwise eslint does not recognise this as export
export { FullAnalysis, ConfidenceLevel };

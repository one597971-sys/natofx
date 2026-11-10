export type DistributionTick = { quote: number; epoch?: number };

export type DigitDistribution = {
    digit: number;
    count: number;
    percentage: number;
};

export type DistributionSnapshot = {
    sampleSize: number;
    ticks: DistributionTick[];
    digits: DigitDistribution[];
    overCount: number;
    underCount: number;
    equalCount: number;
    overPercentage: number;
    underPercentage: number;
    equalPercentage: number;
};

export const DEFAULT_TICK_SAMPLE = 500;

export const getLastDigit = (quote: number, decimalPlaces?: number): number => {
    const precision = Number.isInteger(decimalPlaces) && Number(decimalPlaces) >= 0
        ? Math.min(Number(decimalPlaces), 10)
        : Math.min((String(quote).split('.')[1] || '').length, 10);
    const fixed = Number(quote).toFixed(precision);
    const digits = fixed.replace(/\D/g, '');
    return Number(digits.slice(-1));
};

export const calculateDistribution = (
    ticks: DistributionTick[],
    barrier: number,
    decimalPlaces?: number,
    sampleSize = DEFAULT_TICK_SAMPLE
): DistributionSnapshot => {
    const sample = ticks.slice(-sampleSize);
    const counts = Array.from({ length: 10 }, () => 0);
    let overCount = 0;
    let underCount = 0;
    let equalCount = 0;

    sample.forEach(({ quote }) => {
        const digit = getLastDigit(quote, decimalPlaces);
        counts[digit] += 1;
        if (digit > barrier) overCount += 1;
        else if (digit < barrier) underCount += 1;
        else equalCount += 1;
    });

    const denominator = sample.length || 1;
    return {
        sampleSize: sample.length,
        ticks: sample,
        digits: counts.map((count, digit) => ({
            digit,
            count,
            percentage: (count / denominator) * 100,
        })),
        overCount,
        underCount,
        equalCount,
        overPercentage: (overCount / denominator) * 100,
        underPercentage: (underCount / denominator) * 100,
        equalPercentage: (equalCount / denominator) * 100,
    };
};

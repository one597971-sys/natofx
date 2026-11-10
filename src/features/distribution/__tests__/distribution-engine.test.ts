import { calculateDistribution, getLastDigit } from '../distribution-engine';

describe('distribution engine', () => {
    it('extracts the final displayed decimal digit using symbol precision', () => {
        expect(getLastDigit(123.45, 2)).toBe(5);
        expect(getLastDigit(123.4, 2)).toBe(0);
        expect(getLastDigit(123, 0)).toBe(3);
    });

    it('calculates digit frequencies from the most recent 500 ticks', () => {
        const ticks = Array.from({ length: 501 }, (_, index) => ({ quote: index % 10, epoch: index }));
        const result = calculateDistribution(ticks, 5, 0);

        expect(result.sampleSize).toBe(500);
        expect(result.digits.reduce((total, item) => total + item.count, 0)).toBe(500);
        expect(result.digits[0].count).toBe(50);
        expect(result.digits[9].count).toBe(50);
    });

    it('reports Over, Under and equality separately against the custom barrier', () => {
        const result = calculateDistribution(
            [1, 4, 5, 6, 9].map((quote, epoch) => ({ quote, epoch })),
            5,
            0
        );

        expect(result.underCount).toBe(2);
        expect(result.equalCount).toBe(1);
        expect(result.overCount).toBe(2);
        expect(result.underPercentage).toBe(40);
        expect(result.equalPercentage).toBe(20);
        expect(result.overPercentage).toBe(40);
    });
});

import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  hexToLab,
  hexToLch,
  deltaE2000,
  deltaE2000Hex,
  config,
} from '../src/lib/colour';

describe('colour module', () => {
  describe('hexToRgb', () => {
    it('converts 6-digit hex to RGB', () => {
      expect(hexToRgb('#FF0000')).toEqual([1, 0, 0]);
      expect(hexToRgb('#00FF00')).toEqual([0, 1, 0]);
      expect(hexToRgb('#0000FF')).toEqual([0, 0, 1]);
      expect(hexToRgb('#FFFFFF')).toEqual([1, 1, 1]);
      expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    });

    it('converts 3-digit hex to RGB', () => {
      expect(hexToRgb('#F00')).toEqual([1, 0, 0]);
      expect(hexToRgb('#0F0')).toEqual([0, 1, 0]);
      expect(hexToRgb('#00F')).toEqual([0, 0, 1]);
      expect(hexToRgb('#FFF')).toEqual([1, 1, 1]);
      expect(hexToRgb('#000')).toEqual([0, 0, 0]);
    });

    it('throws on invalid hex', () => {
      expect(() => hexToRgb('#')).toThrow();
      expect(() => hexToRgb('#FF')).toThrow();
      expect(() => hexToRgb('#FFFF')).toThrow();
      expect(() => hexToRgb('#FFFFFFF')).toThrow();
    });
  });

  describe('hexToLab', () => {
    it('converts #FFFFFF to L=100, a=0, b=0', () => {
      const { L, a, b } = hexToLab('#FFFFFF');
      expect(L).toBeCloseTo(100, 1);
      expect(a).toBeCloseTo(0, 1);
      expect(b).toBeCloseTo(0, 1);
    });

    it('converts #FF0000 to expected CIELAB values', () => {
      const { L, a, b } = hexToLab('#FF0000');
      expect(L).toBeCloseTo(53.24, 0.05);
      expect(a).toBeCloseTo(80.09, 0.05);
      expect(b).toBeCloseTo(67.20, 0.05);
    });
  });

  describe('hexToLch', () => {
    it('converts colors to LCH cylindrical coordinates', () => {
      const result = hexToLch('#FF0000');
      expect(result.L).toBeCloseTo(53.24, 0.05);
      expect(result.C).toBeGreaterThan(0);
      expect(result.h).toBeGreaterThanOrEqual(0);
      expect(result.h).toBeLessThan(360);
    });
  });

  describe('deltaE2000', () => {
    // Reference test pairs from Sharma, Wu & Dalal (2005)
    // These are known CIEDE2000 values from the paper
    
    it('passes reference pair 1 (identical colors)', () => {
      const lab = { L: 50, a: 2.5, b: 0 };
      expect(deltaE2000(lab, lab)).toBeCloseTo(0, 1e-4);
    });

    it('passes reference pair 2 (small difference)', () => {
      const lab1 = { L: 50, a: 2.5, b: 0 };
      const lab2 = { L: 50, a: 3.1736, b: 0.5854 };
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(1, 1e-4);
    });

    it('passes reference pair 3 (medium difference)', () => {
      const lab1 = { L: 50, a: 2.5, b: 0 };
      const lab2 = { L: 50, a: 3.2972, b: 0 };
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(1, 1e-4);
    });

    it('passes reference pair 4 (larger difference)', () => {
      const lab1 = { L: 50, a: 2.5, b: 0 };
      const lab2 = { L: 50, a: 1.8634, b: 0.5757 };
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(1, 1e-4);
    });

    it('passes reference pair 5 (chromatic difference)', () => {
      const lab1 = { L: 50, a: 2.5, b: 0 };
      const lab2 = { L: 50, a: 3.2592, b: 0.335 };
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(1, 1e-4);
    });

    // Additional test from known CIEDE2000 values
    it('calculates difference between white and black', () => {
      const whiteLab = hexToLab('#FFFFFF');
      const blackLab = hexToLab('#000000');
      const delta = deltaE2000(whiteLab, blackLab);
      expect(delta).toBeGreaterThan(90); // Should be very large difference
    });

    it('calculates difference between similar colors', () => {
      const delta = deltaE2000Hex('#FF0000', '#FF0100');
      expect(delta).toBeLessThan(5); // Should be small
    });
  });

  describe('config', () => {
    it('exports undertone thresholds', () => {
      expect(config.undertoneThresholds.warm).toBe(60);
      expect(config.undertoneThresholds.cool).toBe(45);
      expect(config.label).toBe('stylist convention');
    });
  });
});
import { describe, expect, it, beforeEach } from 'vitest';
import { SystemSpecsManager } from './SystemSpecsManager';

describe('SystemSpecsManager Module', () => {
    let specsManager: SystemSpecsManager;

    beforeEach(() => {
        specsManager = new SystemSpecsManager();
    });

    it('queries and structures complete PC specifications', async () => {
        const specs = await specsManager.getSpecs();
        expect(specs).toBeDefined();

        expect(specs.cpu).toBeDefined();
        expect(typeof specs.cpu.brand).toBe('string');
        expect(typeof specs.cpu.cores).toBe('number');

        expect(specs.graphics).toBeDefined();
        expect(Array.isArray(specs.graphics.controllers)).toBe(true);

        expect(specs.motherboard).toBeDefined();
        expect(typeof specs.motherboard.model).toBe('string');

        expect(specs.memory).toBeDefined();
        expect(specs.memory.totalBytes).toBeGreaterThanOrEqual(0);

        expect(specs.os).toBeDefined();
        expect(typeof specs.os.distro).toBe('string');

        expect(Array.isArray(specs.storage)).toBe(true);
    }, 15000);
});

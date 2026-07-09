// ── Unit tests: validator base / local / registry / bootstrap ────────────────
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Validator }         from '../js/fhir/validators/base.js';
import { LocalValidator }    from '../js/fhir/validators/local.js';
import { ValidatorRegistry } from '../js/fhir/validators/registry.js';
import { initValidators }    from '../js/fhir/validators/init.js';
import { serverConfig, DefaultConfigProvider } from '../js/fhir/server-config.js';

describe('Validator base class', () => {
  it('returns [] without calling _run() when disabled', async () => {
    const ran = vi.fn(async () => [{ severity: 'error', nodeId: 'x', message: 'm' }]);
    class V extends Validator { get id() { return 'v'; } get name() { return 'V'; } _run(...a) { return ran(...a); } }
    const v = new V();
    v.enabled = false;
    expect(await v.run({}, [], {})).toEqual([]);
    expect(ran).not.toHaveBeenCalled();
  });

  it('delegates to _run() when enabled', async () => {
    class V extends Validator { get id() { return 'v'; } get name() { return 'V'; } async _run() { return [{ severity: 'warning', nodeId: 'n', message: 'm' }]; } }
    const v = new V();
    expect(await v.run({}, [], {})).toHaveLength(1);
  });

  it('throws if name is not implemented', () => {
    const v = new Validator();
    expect(() => v.name).toThrow();
  });

  it('defaults: enabled=true, type="local", _run()=[]', async () => {
    const v = new Validator();
    expect(v.enabled).toBe(true);
    expect(v.type).toBe('local');
    expect(await v._run({}, [], {})).toEqual([]);
  });
});

describe('LocalValidator', () => {
  it('exposes the expected id/name/type', () => {
    const v = new LocalValidator({ name: 'Built-in' });
    expect(v.id).toBe('local');
    expect(v.name).toBe('Built-in');
    expect(v.type).toBe('local');
  });

  it('surfaces validateTree issues (que-0 name warning)', async () => {
    const v = new LocalValidator();
    const issues = await v.run({ name: 'badname' }, [], {});
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.some(i => i.severity === 'warning' && /que-0/.test(i.message))).toBe(true);
  });

  it('returns no que-0 warning for a conforming name', async () => {
    const v = new LocalValidator();
    const issues = await v.run({ name: 'GoodName' }, [], {});
    expect(issues.some(i => /que-0/.test(i.message))).toBe(false);
  });

  it('surfaces a modifierExtension warning from the questJson root', async () => {
    const v = new LocalValidator();
    const questJson = {
      name: 'GoodName',
      modifierExtension: [{ url: 'http://example.org/mod', valueBoolean: true }],
    };
    const issues = await v.run(questJson, [], {});
    expect(issues.some(i => i.severity === 'warning' && /modifierExtension/.test(i.message))).toBe(true);
  });

  it('emits no modifierExtension warning when the questJson root has none', async () => {
    const v = new LocalValidator();
    const issues = await v.run({ name: 'GoodName' }, [], {});
    expect(issues.some(i => /modifierExtension/.test(i.message))).toBe(false);
  });
});

describe('ValidatorRegistry', () => {
  it('registers and lists validators', () => {
    const reg = new ValidatorRegistry();
    const v = new LocalValidator();
    reg.register(v);
    expect(reg.getAll()).toEqual([v]);
  });

  it('runs all validators in parallel and tags results', async () => {
    const reg = new ValidatorRegistry();
    class A extends Validator { get id() { return 'a'; } get name() { return 'A'; } async _run() { return [{ severity: 'error', nodeId: 'x', message: 'm' }]; } }
    const a = new A();
    reg.register(a);
    const results = await reg.runAll({}, [], {});
    expect(results).toHaveLength(1);
    expect(results[0].validator).toBe(a);
    expect(results[0].issues).toHaveLength(1);
    expect(results[0].error).toBeNull();
  });

  it('captures per-validator errors without rejecting', async () => {
    const reg = new ValidatorRegistry();
    class Boom extends Validator { get id() { return 'boom'; } get name() { return 'Boom'; } async _run() { throw new Error('kaboom'); } }
    reg.register(new Boom());
    const results = await reg.runAll({}, [], {});
    expect(results[0].issues).toEqual([]);
    expect(results[0].error).toBeInstanceOf(Error);
    expect(results[0].error.message).toBe('kaboom');
  });
});

describe('initValidators', () => {
  afterEach(() => { serverConfig._clear(); vi.unstubAllGlobals(); });

  it('registers local + external validators from config.json', async () => {
    serverConfig.register(new DefaultConfigProvider({
      validators: [
        { type: 'local', name: 'Built-in' },
        { type: 'external', name: 'HAPI FHIR', url: 'https://hapi.fhir.org/baseR4' },
      ],
    }));
    const { validatorRegistry } = await import('../js/fhir/validators/registry.js');
    const before = validatorRegistry.getAll().length;
    await initValidators({ localEnabled: true, externalEnabled: true, getFhirTarget: () => 'R4' });
    const added = validatorRegistry.getAll().slice(before);
    expect(added.map(v => v.id)).toContain('local');
    expect(added.map(v => v.id)).toContain('external');
    const ext = added.find(v => v.id === 'external');
    expect(ext.enabled).toBe(true);
    expect(ext.name).toBe('HAPI FHIR R4');
  });

  it('falls back to a local validator when no validators configured', async () => {
    // No providers registered — serverConfig.getParsed('validators') returns null
    const { validatorRegistry } = await import('../js/fhir/validators/registry.js');
    const before = validatorRegistry.getAll().length;
    await initValidators({ localEnabled: true });
    const added = validatorRegistry.getAll().slice(before);
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe('local');
    expect(added[0].enabled).toBe(true);
  });

  it('skips external definitions that have no url', async () => {
    serverConfig.register(new DefaultConfigProvider({
      validators: [{ type: 'external', name: 'No URL' }],
    }));
    const { validatorRegistry } = await import('../js/fhir/validators/registry.js');
    const before = validatorRegistry.getAll().length;
    await initValidators({});
    expect(validatorRegistry.getAll().length).toBe(before);
  });
});

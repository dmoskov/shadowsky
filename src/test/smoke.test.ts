/**
 * Smoke Test
 * Basic test to verify Jest setup is working correctly
 */

describe('Jest Setup', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with TypeScript', () => {
    const add = (a: number, b: number): number => a + b;
    expect(add(2, 3)).toBe(5);
  });

  it('should have access to DOM testing utilities', () => {
    document.body.innerHTML = '<div>Hello World</div>';
    const element = document.querySelector('div');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello World');
  });

  it('should support async tests', async () => {
    const promise = Promise.resolve('success');
    await expect(promise).resolves.toBe('success');
  });

  it('should have mocked window APIs', () => {
    expect(window.matchMedia).toBeDefined();
    expect(window.IntersectionObserver).toBeDefined();
    expect(window.ResizeObserver).toBeDefined();
    expect(crypto.randomUUID).toBeDefined();
  });
});
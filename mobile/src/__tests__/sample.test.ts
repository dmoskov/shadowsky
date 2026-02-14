// Sample test to verify Jest is working
describe('Sample Tests', () => {
  test('basic math works', () => {
    expect(1 + 1).toBe(2);
  });

  test('string concatenation', () => {
    const result = 'Hello' + ' ' + 'World';
    expect(result).toBe('Hello World');
  });

  test('array manipulation', () => {
    const arr = [1, 2, 3];
    arr.push(4);
    expect(arr).toEqual([1, 2, 3, 4]);
    expect(arr.length).toBe(4);
  });

  test('object equality', () => {
    const obj = { name: 'Test', value: 123 };
    expect(obj).toEqual({ name: 'Test', value: 123 });
  });

  test('truthy and falsy', () => {
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect(null).toBeFalsy();
    expect(undefined).toBeFalsy();
    expect(0).toBeFalsy();
    expect('').toBeFalsy();
    expect('hello').toBeTruthy();
    expect(1).toBeTruthy();
  });

  test('async operations', async () => {
    const promise = Promise.resolve('success');
    const result = await promise;
    expect(result).toBe('success');
  });
});

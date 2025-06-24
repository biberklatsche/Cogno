import {Color} from './color';

describe('Color', () => {

  it('should work with lighten', () => {
    const newColor = Color.lightenDarkenColor('#000000', +10);
    expect(newColor).toEqual('#0a0a0a');
  });

  it('should work with lighten white', () => {
    const newColor = Color.lightenDarkenColor('#ffffff', +10);
    expect(newColor).toEqual('#ffffff');
  });

  it('should work with darken', () => {
    const newColor = Color.lightenDarkenColor('#ffffff', -10);
    expect(newColor).toEqual('#f5f5f5');
  });

  it('should work with darken black', () => {
    const newColor = Color.lightenDarkenColor('#000000', -10);
    expect(newColor).toEqual('#000000');
  });

  it('should work with opacity hex lighten', () => {
    const newColor = Color.lightenDarkenColor('#00000040', 10);
    expect(newColor).toEqual('#0a0a0a40');
  });

  it('should work with opacity hex darken', () => {
    const newColor = Color.lightenDarkenColor('#ffffff40', -10);
    expect(newColor).toEqual('#f5f5f540');
  });

  it('should return no hex opacity if value is null or undefined', () => {
    expect( Color.getHexOpacity(null)).toEqual('');
    expect( Color.getHexOpacity(undefined)).toEqual('');
  });

  it('should return FF opacity if value is 100 or bigger', () => {
    expect( Color.getHexOpacity(100)).toEqual('FF');
    expect( Color.getHexOpacity(110)).toEqual('FF');
  });

  it('should return no opacity if value is 0 or smaller', () => {
    expect( Color.getHexOpacity(0)).toEqual('00');
    expect( Color.getHexOpacity(-1)).toEqual('00');
  });

  it('should return isLight false if color is black', () => {
    expect( Color.isLight('#000000')).toBeFalsy();
  });

  it('should return isLight true if color is white', () => {
    expect( Color.isLight('#ffffff')).toBeTruthy();
  });

  it('should return isValid false if color is undefined', () => {
    expect( Color.isValid(undefined)).toBeFalsy();
  });

  it('should return isValid false if color is null', () => {
    expect( Color.isValid(null)).toBeFalsy();
  });

  it('should return isValid false if color is empty', () => {
    expect( Color.isValid('')).toBeFalsy();
  });

  it('should return isValid false if color does not start with #', () => {
    expect( Color.isValid('000000')).toBeFalsy();
  });

  it('should return isValid false if color is to short', () => {
    expect( Color.isValid('#00000')).toBeFalsy();
  });

  it('should return isValid true if color is valid', () => {
    expect( Color.isValid('#000000')).toBeTruthy();
  });
});

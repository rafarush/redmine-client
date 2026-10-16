/** `textile-js` no trae tipos. Solo se usa `parse`. */
declare module 'textile-js' {
  const textile: {
    parse: (text: string, options?: { breaks?: boolean }) => string
  }
  export default textile
}

/**
 * Recursively searches for all values associated with a given key in a nested object.
 *
 * @param {Object} obj - The input object to search.
 * @param {string} keyToFind - The key to search for in the object.
 * @returns {Array} - An array containing all values associated with the specified key.
 */
function findAllByKey(obj, keyToFind) {
  // Using Object.entries to iterate through key-value pairs of the object
  return Object.entries(obj).reduce(
    (acc, [key, value]) =>
      key === keyToFind
        ? acc.concat(value) // If the current key matches the keyToFind, add the corresponding value to the result array
        : typeof value === "object" && value
        ? acc.concat(findAllByKey(value, keyToFind)) // If the current value is an object, recursively call findAllByKey on it
        : acc,
    []
  );
}

/**
 * Replaces all occurrences of a specified substring with another substring in a given string.
 *
 * @param {string} str - The input string in which replacements will be made.
 * @param {string} find - The substring to be replaced.
 * @param {string} replace - The substring to replace the 'find' substring.
 * @returns {string} - A new string with all occurrences of 'find' replaced by 'replace'.
 */
function replaceAll(str, find, replace) {
  // Using RegExp with "g" flag to perform a global search for all occurrences of 'find' in 'str'
  return str.replace(new RegExp(find, "g"), replace);
}

/**
 * Removes HTTP method prefixes ("/post", "/get", "/put", "/delete") from the given string.
 *
 * @param {string} _str - The input string containing HTTP method prefixes.
 * @returns {string} - A new string with HTTP method prefixes removed.
 */
function replaceHttpMethod(_str) {
  // Remove "/post" from the string
  let str = _str.replace("/post", "");

  // Remove "/get" from the string
  str = str.replace("/get", "");

  // Remove "/put" from the string
  str = str.replace("/put", "");

  // Remove "/delete" from the string
  str = str.replace("/delete", "");

  // Return the modified string
  return str;
}

module.exports = {
  findAllByKey,
  replaceAll,
  replaceHttpMethod,
};

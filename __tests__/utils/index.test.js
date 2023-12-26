const {
  findAllByKey,
  replaceAll,
  replaceHttpMethod,
} = require("../../src/lib/utils");

describe("findAllByKey function", () => {
  // Test case 1
  test("should return an array of values associated with the specified key", () => {
    const sampleObject = {
      key1: "value1",
      key2: {
        key3: "value2",
        key4: {
          key5: "value3",
          key6: "value4",
        },
      },
      key7: "value5",
    };

    const keyToFind = "key6";
    const result = findAllByKey(sampleObject, keyToFind);

    expect(result).toEqual(["value4"]);
  });

  // Test case 2
  test("should return an empty array if the key is not found", () => {
    const sampleObject = {
      key1: "value1",
      key2: {
        key3: "value2",
        key4: {
          key5: "value3",
          key6: "value4",
        },
      },
      key7: "value5",
    };

    const keyToFind = "nonexistentKey";
    const result = findAllByKey(sampleObject, keyToFind);

    expect(result).toEqual([]);
  });
});

describe("replaceAll function", () => {
  // Test case 1
  test("should replace all occurrences of a substring in a string", () => {
    const inputString = "Hello, world! Hello, universe!";
    const findSubstring = "Hello";
    const replacement = "Hi";

    const result = replaceAll(inputString, findSubstring, replacement);

    // Expect the result to have all occurrences of 'Hello' replaced with 'Hi'
    expect(result).toEqual("Hi, world! Hi, universe!");
  });

  // Test case 2
  test("should handle empty string input", () => {
    const inputString = "";
    const findSubstring = "a";
    const replacement = "b";

    const result = replaceAll(inputString, findSubstring, replacement);

    // Expect the result to be an empty string since there are no occurrences of 'a' in an empty string
    expect(result).toEqual("");
  });

  // Test case 3
  test("should handle special characters in find substring with escape characters", () => {
    const inputString = "The price is $50. The price is $50.";
    const findSubstring = "\\$50";
    const replacement = "€50";

    const result = replaceAll(inputString, findSubstring, replacement);

    // Expect the result to have all occurrences of '$50' replaced with '€50'
    expect(result).toEqual("The price is €50. The price is €50.");
  });
});

describe("replaceHttpMethod function", () => {
  // Test case 1
  test("should remove HTTP method prefixes from the string", () => {
    const inputString = "/post/data/get/info/put/item/delete/resource";
    const result = replaceHttpMethod(inputString);

    // Expect the result to have all HTTP method prefixes removed
    expect(result).toEqual("/data/info/item/resource");
  });

  // Test case 2
  test("should handle an empty string input", () => {
    const inputString = "";
    const result = replaceHttpMethod(inputString);

    // Expect the result to be an empty string since the input is empty
    expect(result).toEqual("");
  });

  // Test case 3
  test("should handle a string with no HTTP method prefixes", () => {
    const inputString = "/path/to/resource";
    const result = replaceHttpMethod(inputString);

    // Expect the result to be the same as the input string since there are no method prefixes to remove
    expect(result).toEqual("/path/to/resource");
  });
});

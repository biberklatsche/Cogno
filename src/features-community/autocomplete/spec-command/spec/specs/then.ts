const completionSpec: CommandSpec = {
  name: "then",
  description: "Execute this command if the test returned 0",
  args: {
    isCommand: true,
  },
};

export default completionSpec;

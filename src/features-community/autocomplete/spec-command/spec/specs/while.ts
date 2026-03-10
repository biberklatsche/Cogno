const completionSpec: CommandSpec = {
  name: "while",
  description: "Repeat a command while this is true",
  args: {
    isCommand: true,
  },
};

export default completionSpec;

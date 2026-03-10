const completionSpec: CommandSpec = {
  name: "elif",
  description: "Execute if the previous condition returned 0",
  args: {
    isCommand: true,
  },
};

export default completionSpec;

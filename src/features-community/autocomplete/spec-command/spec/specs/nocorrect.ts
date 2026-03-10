const completionSpec: CommandSpec = {
  name: "nocorrect",
  description: "ZSH pre-command modifier that disables correction",
  hidden: true,
  args: {
    isCommand: true,
  },
};

export default completionSpec;

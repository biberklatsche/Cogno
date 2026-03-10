const completionSpec: CommandSpec = {
  name: "export",
  description: "Export variables",
  hidden: true,
  args: {
    isVariadic: true,
  },
};

export default completionSpec;

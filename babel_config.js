const path = require("path");

module.exports = {
  babelSharedLoader: {
    test:    /\.jsx?$/,
    include: [
      path.resolve(__dirname, "src"),
    ],
    loader:  "babel-loader",
    query:   {
      presets: [
        ["@babel/preset-env", { modules: false }],
      ],
      plugins: []
    }
  }
}

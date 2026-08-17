module.exports = {
  apps: [{
    name: "application-bek",
    script: "./index.js",
    cwd: "C:\\Users\\webuser\\Desktop\\application-bek",
    env: {
      NODE_EXTRA_CA_CERTS: "C:\\certs\\mincifry-chain.pem"
    }
  }]
};
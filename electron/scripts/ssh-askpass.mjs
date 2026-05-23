/** OpenSSH SSH_ASKPASS helper — prints password from NIOZY_SSH_PASS (never embed password in this file). */
console.log(process.env.NIOZY_SSH_PASS ?? '')

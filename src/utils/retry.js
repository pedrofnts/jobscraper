const retry = require("retry");

const retryOperation = async (operation, options = {}) => {
  const op = retry.operation({
    retries: options.retries || 3,
    factor: options.factor || 2,
    minTimeout: options.minTimeout || 1000,
    maxTimeout: options.maxTimeout || 60000,
  });

  return new Promise((resolve, reject) => {
    op.attempt(async (currentAttempt) => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        if (op.retry(error)) {
          return;
        }
        reject(op.mainError());
      }
    });
  });
};

module.exports = retryOperation;

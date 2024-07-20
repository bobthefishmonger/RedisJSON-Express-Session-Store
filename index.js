const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
let RedisClient;
let ClientSet = false;
/**
 * Constructs or Sets the RedisClient for RedisStore
 *
 * Required to be called before any RedisJSON function
 * @param {RedisClientType} client - Constructed client for redis
 * @param {object} options - Options for a client if none provided
 * @returns {RedisClientType}
 */
function setClient(client, options) {
	if (client) RedisClient = client;
	if (options) {
		RedisClient = createClient(options);
	} else {
		throw Error("Unset Redis Client Options or Redis Client");
	}
	RedisClient.connect();
	RedisJSONget = RedisClient.json.get.bind(RedisClient.json);
	RedisJSONset = RedisClient.json.set.bind(RedisClient.json);
	RedisJSONdel = RedisClient.json.del.bind(RedisClient.json);
	ClientSet = true;
	return RedisClient;
}
/**
 * Creates the JSON store for use inside the express-session middleware
 * @returns {class}
 */
function createJSONStore() {
	if (ClientSet) {
		class RedisJSONstore extends RedisStore {
			constructor(options, prefix = `sess:`) {
				super(options);
				this.prefix = prefix;
			}

			async get(sid, cb) {
				try {
					const data = await RedisJSONget(`${this.prefix}${sid}`);
					cb(null, data);
				} catch (err) {
					cb(err);
				}
			}
			async set(sid, sessionData, cb) {
				try {
					await RedisJSONset(
						`${this.prefix}${sid}`,
						".",
						sessionData
					);
					cb(null);
				} catch (err) {
					cb(err);
				}
			}
			async del(sid, cb) {
				try {
					await RedisJSONdel(`${this.prefix}${sid}`);
					cb(null);
				} catch (err) {
					cb(err);
				}
			}
		}
		const store = new RedisJSONstore({ client: RedisClient });
		return store;
	} else {
		throw Error("setClient has not been ran");
	}
}
/**
 * Client JSON get bound to the client
 */
let RedisJSONget;
/**
 * Client JSON set bound to the client
 */
let RedisJSONset;
/**
 * Client JSON delete bound to the client
 */
let RedisJSONdel;

/**
 * Keeps track of all sessionID's that are being read or written to
 */
const activesession = new Map();

/**
 * Changes a key-value pair in the RedisStore
 * @param {*} sessionID - Express-sessionID
 * @param {string} key - The key for the value to change.
 * An empty string would replace the entire session.
 * @param {*} data - The value to set the key to
 * @param {string} prefix - Optional- If sessionID prefix has been updated in express-session,
 * then this should be updated, else it is set as "sess:"
 */

async function setSession(sessionID, key, data, prefix = "sess:") {
	activesession.set(sessionID, 1);
	await RedisJSONset(`${prefix}${sessionID}`, `.${key}`, data);
	activesession.delete(sessionID);
}

/**
 * Changes 2 key-value pairs in the RedisStore
 * @param {*} sessionID - Express-sessionID
 * @param {Array<[string, string]>} key - The keys for the value to change.
 * An empty string would replace the entire session.
 * @param {Array<[*, *]} data - The values to set the key to
 * @param {string} prefix - Optional- If sessionID prefix has been updated in express-session,
 * then this should be updated, else it is set as "sess:"
 */

async function setSessiondouble(sessionID, keys, data, prefix = "sess:") {
	activesession.set(sessionID, 1);
	await RedisJSONset(`${prefix}${sessionID}`, `.${keys[0]}`, data[0]);
	await RedisJSONset(`${prefix}${sessionID}`, `.${keys[1]}`, data[1]);
	activesession.delete(sessionID);
}

/**
 * Retrieves the sessiondata from a sessionID
 * @param {*} sessionID - Express-sessionID
 * @param {string} prefix - Optional- If sessionID prefix has been updated in express-session,
 * then this should be updated, else it is set as "sess:"
 * @returns {object}SessionData
 */
async function getSession(sessionID, prefix = "sess:") {
	activesession.set(sessionID, 1);
	const data = await RedisJSONget(`${prefix}${sessionID}`);
	activesession.delete(sessionID);
	return data;
}
/**
 *
 * @param {*} sessionID - Express-sessionID
 * @param {*} interval - Ajusts the amount of time between checks on the sessionID
 *
 * Default: 2ms
 * @param {*} timeout - Ajusts the amount of time before an timeout error
 *
 * Default: 500ms
 */
async function inactiveSession(sessionID, interval = 2, timeout = 500) {
	return new Promise((resolve, reject) => {
		let Inteval = setInterval(() => {
			if (!activesession.get(sessionID)) {
				clearInterval(Inteval);
				clearTimeout(Timout);
				resolve("Session is inactive");
			}
		}, interval);

		let Timout = setTimeout(() => {
			clearInterval(Inteval);
			reject("Request for inactive session timed out");
		}, timeout);
	});
}

module.exports = {
	RedisClient,
	setClient,
	createJSONStore,
	setSession,
	setSessiondouble,
	getSession,
	activesession,
	inactiveSession,
	RedisJSONdel,
	RedisJSONget,
	RedisJSONset
};

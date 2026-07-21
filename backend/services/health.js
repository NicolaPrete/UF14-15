import {pool} from "./dbSession.js";
import {catchAsync} from "../utils/errorHandler.js";

export const retrieveHealthStatusFn = catchAsync(async (req, res) => {
	const healthStatus = {
		service: 'UP',
		instance: process.env.BACKEND_INSTANCE || 'unknown',
		database: 'UNKNOWN',
		uptime: process.uptime()
	};

	try {
		await pool.query('SELECT 1');
		healthStatus.database = 'CONNECTED';
	} catch (err) {
		healthStatus.database = 'DISCONNECTED';
	}

	res.status(200).json({
		status: 'success',
		data: healthStatus
	});
});
const jwt = require('jsonwebtoken')
const path = require('path')
const mkdirp = require('mkdirp')
const Users = require('../repository/users')
const UploadService = require('../services/file-upload')
const { HttpCode } = require('../config/constants')
const EmailService = require('../services/email/service')
const { CreateSenderNodemailer } = require('../services/email/sender')

require('dotenv').config()
const SECRET_KEY = process.env.JVT_SECRET_KEY

const registration = async (req, res, next) => {
	const { name, email, password, subscription } = req.body
	const user = await Users.findByEmail(email)
	if (user) {
		return res.status(HttpCode.CONFLICT).json({
			status: 'error',
			code: HttpCode.CONFLICT,
			message: 'Email is already exist',
		})
	}
	try {
		// TODO: Send email for verify users

		const newUser = await Users.create({
			name,
			email,
			password,
			subscription,
		})
		const emailService = new EmailService(
			process.env.NODE_ENV,
			new CreateSenderNodemailer()
		)
		const statusEmail = await emailService.sendVerifyEmail(
			newUser.email,
			newUser.name,
			newUser.verifyToken
		)
		return res.status(HttpCode.CREATED).json({
			status: 'success',
			code: HttpCode.CREATED,
			data: {
				id: newUser.id,
				name: newUser.name,
				email: newUser.email,
				subscription: newUser.subscription,
				avatar: newUser.avatar,
				successEmail: statusEmail,
			},
		})
	} catch (e) {
		next(e)
	}
}

const login = async (req, res, next) => {
	const { email, password } = req.body
	const user = await Users.findByEmail(email)
	const isValidPassword = await user.isValidPassword(password)
	if (!user || !isValidPassword || !user?.isVerified) {
		return res.status(HttpCode.UNAUTHORIZED).json({
			status: 'error',
			code: HttpCode.UNAUTHORIZED,
			message: 'Invalid credentials',
		})
	}
	const id = user._id
	const payload = { id }
	const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1d' })
	console.log(token)
	await Users.updateToken(id, token)
	return res.status(HttpCode.OK).json({
		status: 'success',
		code: HttpCode.OK,
		date: {
			token,
		},
	})
}

const logout = async (req, res, next) => {
	const id = req.user._id
	await Users.updateToken(id, null)
	return res.status(HttpCode.NO_CONTENT).json({ test: 'test' })
}

const current = async (req, res, next) => {
	const { email } = req.body
	const user = await Users.findByEmail(email)
	if (!user) {
		return res.status(HttpCode.UNAUTHORIZED).json({
			status: 'error',
			code: HttpCode.UNAUTHORIZED,
			message: 'Not authorized',
		})
	}
	const subscription = user.subscription
	return res.status(HttpCode.OK).json({
		status: 'success',
		code: HttpCode.OK,
		date: {
			email,
			subscription,
		},
	})
}

const uploadAvatar = async (req, res, next) => {
	const id = String(req.user._id)
	const file = req.file
	const AVATAR_OF_USERS = process.env.AVATAR_OF_USERS
	const destination = path.join(AVATAR_OF_USERS, id)
	await mkdirp(destination)
	const uploadService = new UploadService(destination)
	const avatarUrl = await uploadService.save(file, id)
	await Users.updateAvatar(id, avatarUrl)

	return res.status(HttpCode.OK).json({
		status: 'success',
		code: HttpCode.OK,
		date: {
			avatar: avatarUrl,
		},
	})
}

const verifyUser = async (req, res, next) => {
	const user = await Users.findUserByVerifyToken(req.params.token)
	if (user) {
		await Users.updateTokenVerify(user._id, true, null)
		return res.status(HttpCode.OK).json({
			status: 'success',
			code: HttpCode.OK,
			data: {
				message: 'Success',
			},
		})
	}
	return res.status(HttpCode.BAD_REQUEST).json({
		status: 'error',
		code: HttpCode.BAD_REQUEST,
		message: 'Invalid token',
	})
}

const repeatEmailForVerifyUser = async (req, res, next) => {
	const { email } = req.body
	const user = await Users.findByEmail(email)
	if (user) {
		const { email, name, verifyToken } = user
		const emailService = new EmailService(
			process.env.NODE_ENV,
			new CreateSenderNodemailer()
		)
		const statusEmail = await emailService.sendVerifyEmail(
			email,
			name,
			verifyToken
		)
	}
	return res.status(HttpCode.OK).json({
		status: 'success',
		code: HttpCode.OK,
		data: {
			message: 'Success',
		},
	})
}

module.exports = {
	registration,
	login,
	logout,
	current,
	uploadAvatar,
	verifyUser,
	repeatEmailForVerifyUser,
}

const ApiError = require("../error/ApiError");
const { Application, User } = require("../models/model");

class ApplicationController {
  async create(req, res, next) {
    try {
      const {
        dealId,
        date,
        clientBio,
        clientPhone,
        city,
        type,
        carQuantity,
        carBrand,
        comment,
        allCarQuantity,
        forFreight,
        forCars,
        freightBrand,
        relay,
        userId,
      } = req.body;

      const application = await Application.findOne({
        where: {
          userId,
          dealId,
        },
      });

      if (application) {
        if (application.status === "rejected") {
          application.status = "pending";

          application.date = date;
          application.clientBio = clientBio;
          application.clientPhone = clientPhone;
          application.city = city;
          application.type = type;
          application.carQuantity = carQuantity;
          application.carBrand = carBrand;
          application.comment = comment;
          application.allCarQuantity = allCarQuantity;
          application.forFreight = forFreight;
          application.forCars = forCars;
          application.freightBrand = freightBrand;
          application.relay = relay;

          await application.save();
        }

        return res.json(application);
      }

      const newApplication = await Application.create({
        dealId,
        date,
        clientBio,
        clientPhone,
        city,
        type,
        carQuantity,
        carBrand,
        comment,
        allCarQuantity,
        forFreight,
        forCars,
        freightBrand,
        relay,
        userId,
      });

      return res.json(newApplication);
    } catch (err) {
      console.log(err);
      return next(ApiError.badRequest(err.message));
    }
  }
  async getAll(req, res, next) {
    try {
      const userId = req.user.id;
      const applications = await Application.findAll({
        where: { userId },
      });
      return res.json(applications);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
  async getOne(req, res, next) {
    try {
      const { userId, dealId } = req.params;
      const application = await Application.findOne({
        where: { userId, dealId },
        include: [
          {
            model: User,
            attributes: ["id", "firstName", "lastName", "email", "role"],
          },
        ],
      });
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
  async reject(req, res, next) {
    try {
      const { userId, dealId } = req.params;
      const application = await Application.findOne({
        where: { userId, dealId },
      });
      application.status = "rejected";
      await application.save();
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async acceptApp(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const application = await Application.findOne({ where: { userId, id } });
      application.status = "accepted";
      await application.save();
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
  async rejectApp(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const application = await Application.findOne({ where: { userId, id } });
      application.status = "rejected";
      await application.save();
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new ApplicationController();

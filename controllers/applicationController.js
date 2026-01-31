const { Application } = require("../models/model");

class ApplicationController {
  async create(req, res, next) {
    try {
      const {
        dealId,
        clientBio,
        clientPhone,
        city,
        type,
        carQuantity,
        carBrand,
        commnet,
        userId,
      } = req.body;

      if (
        !dealId ||
        !clientBio ||
        !clientPhone ||
        !city ||
        !type ||
        !carQuantity ||
        !carBrand ||
        !commnet ||
        !userId
      ) {
        return next(ApiError.badRequest("Заполните все поля"));
      }

      const application = await Application.findOne({
        where: {
          userId,
          dealId,
        },
      });

      if (application) {
        if (application.status === "rejected") {
          application.status = "pending";

          application.clientBio = clientBio;
          application.clientPhone = clientPhone;
          application.city = city;
          application.type = type;
          application.carQuantity = carQuantity;
          application.carBrand = carBrand;
          application.commnet = commnet;

          await application.save();
        }

        return res.json(application);
      }

      const newApplication = await Application.create({
        dealId,
        clientBio,
        clientPhone,
        city,
        type,
        carQuantity,
        carBrand,
        commnet,
        userId,
      });

      return res.json(newApplication);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async getAll(req, res, next) {
    try {
      const applications = await Application.findAll();
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
      });
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new ApplicationController();
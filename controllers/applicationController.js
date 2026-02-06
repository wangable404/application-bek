const path = require("path");
const ApiError = require("../error/ApiError");
const {
  Application,
  User,
  ApplicationCompletion,
  ApplicationPhoto,
  Chat,
  Message,
} = require("../models/model");
const { model } = require("../db");

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
        workType,
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
          application.workType = workType;

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
        workType,
        userId,
      });

      await Chat.create({ applicationId: newApplication.id });

      return res.json(newApplication);
    } catch (err) {
      console.log(err);
      return next(ApiError.badRequest(err.message));
    }
  }
  async getAll(req, res, next) {
    try {
      const user = req.user;

      if (user.role == "ADMIN") {
        const applications = await Application.findAll({
          include: [
            { model: User },
            {
              model: ApplicationCompletion,
              include: { model: ApplicationPhoto },
            },
          ],
        });
        return res.json(applications);
      }

      const applications = await Application.findAll({
        where: { userId: user.id },
        include: [
          {
            model: Chat,
            include: [{ model: Message, order: [["createdAt", "DESC"]] }],
          },
        ],
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

  async updateWorktype(req,res,next){
    try {
      const { userId, dealId } = req.params;
      const { workType } = req.body;
      const application = await Application.findOne({
        where: { userId, dealId },
      });
      application.workType = workType;
      await application.save();
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async getOneAdmin(req, res, next) {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== "ADMIN") {
      return next(ApiError.forbidden("Нет доступа"));
    }

    const application = await Application.findOne({
      where: { id: id },
      include: [
        { model: User },
        { model: ApplicationCompletion, include: { model: ApplicationPhoto } },
      ],
    });

    if (!application) {
      return next(ApiError.badRequest("Application not found"));
    }

    return res.json(application);
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
  async changeStatus(req, res, next) {
    try {
      const { id, status } = req.params;
      const userId = req.user.id;
      const application = await Application.findOne({ where: { userId, id } });
      application.status = status;
      await application.save();
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
  async startWork(req, res, next) {
    const { id } = req.params;
    const { agreedDate, startWorkComment, workType } = req.body;
    const user = req.user;

    const application = await Application.findOne({ where: { id } });

    if (user.id !== application.userId) {
      return next(ApiError.forbidden("Нет доступа"));
    }

    application.agreedDate = agreedDate;
    application.startWorkComment = startWorkComment;
    application.workType = workType;
    await application.save();
    return res.json(application);
  }
  async completeApplication(req, res, next) {
    try {
      const { id } = req.params;
      const { equipment, completedWorks, actSigned } = req.body;

      const application = await Application.findByPk(id);
      if (!application) {
        return next(ApiError.badRequest("Application not found"));
      }

      const completion = await ApplicationCompletion.create({
        applicationId: id,
        equipment: JSON.parse(equipment),
        completedWorks: JSON.parse(completedWorks),
        actSigned: JSON.parse(actSigned),
      });

      if (req.files && req.files.photos) {
        const files = Array.isArray(req.files.photos)
          ? req.files.photos
          : [req.files.photos];

        const photos = [];

        for (const file of files) {
          const uploadPath = path.resolve(
            __dirname,
            "..",
            "static",
            "uploads",
            file.name,
          );

          await file.mv(uploadPath);

          photos.push({
            completionId: completion.id,
            path: "/uploads/" + file.name,
          });
        }

        await ApplicationPhoto.bulkCreate(photos);

        console.log("Загруженные фото:", photos);
      }

      await application.update({ status: "review" });

      return res.json({
        success: true,
        completion,
      });
    } catch (e) {
      console.error(e);
      return next(ApiError.badRequest(e.message));
    }
  }
}

module.exports = new ApplicationController();

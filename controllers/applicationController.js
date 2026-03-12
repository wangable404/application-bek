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
const sequelize = require("../db");

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
        products,
        priceStreet,
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
          application.priceStreet = priceStreet;
          application.products = products;
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
        priceStreet,
        products,
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
          {
            model: ApplicationCompletion,
            include: { model: ApplicationPhoto },
          },
        ],
      });
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async updateWorktype(req, res, next) {
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
      const user = req.user;
      const { comment } = req.body;

      if (user.role == "ADMIN") {
        const application = await Application.findOne({ where: { id } });

        if (!application) {
          return next(ApiError.badRequest("Заявка не найдена"));
        }

        if (status === "in_progress") {
          // Проверяем, что комментарий предоставлен
          if (!comment || !comment.trim()) {
            return next(
              ApiError.badRequest(
                "Необходимо указать причину возврата на доработку",
              ),
            );
          }
          application.returnComment = comment;
        }
        application.status = status;
        await application.save();
        return res.json(application);
      }

      const application = await Application.findOne({
        where: { userId: user.id, id },
      });
      application.status = status;
      await application.save();
      return res.json(application);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
  async startApplication(req, res, next) {
    try {
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
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async completeApplication(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { equipment, actSigned, completionComment, cars, sendType } = req.body;
      console.log('==============');
      console.log(sendType);
      console.log('==============');
      
      const application = await Application.findByPk(id, { transaction });
      if (!application) {
        await transaction.rollback();
        return next(ApiError.badRequest("Заявка не найдена"));
      }

      if (application.status !== "in_progress") {
        await transaction.rollback();
        return next(
          ApiError.badRequest("Заявка не находится в статусе 'in_progress'"),
        );
      }

      if (!req.files || !req.files.photos) {
        await transaction.rollback();
        return next(
          ApiError.badRequest("Необходимо загрузить фото выполнения"),
        );
      }

      // Парсим данные
      let parsedEquipment = [];
      let parsedCars = [];

      try {
        parsedEquipment = JSON.parse(equipment);

        // Если есть cars, парсим их
        if (cars) {
          parsedCars = JSON.parse(cars);
        } else {
          // Если cars нет, создаем структуру из equipment и фото
          // Это для обратной совместимости
          parsedCars = [
            {
              id: "1",
              brand: application.carBrand || "",
              licensePlate: "",
              imei: "",
              imeiPhoto: null,
              equipment: parsedEquipment,
              photos: [],
            },
          ];
        }
      } catch (e) {
        await transaction.rollback();
        return next(ApiError.badRequest("Ошибка парсинга данных"));
      }

      // Валидация структуры cars
      if (!Array.isArray(parsedCars) || parsedCars.length === 0) {
        await transaction.rollback();
        return next(ApiError.badRequest("Данные об автомобилях некорректны"));
      }

      for (const [index, car] of parsedCars.entries()) {
        if (!car.brand || !car.licensePlate) {
          await transaction.rollback();
          return next(
            ApiError.badRequest(
              `Автомобиль ${index + 1}: не указаны марка или гос номер`,
            ),
          );
        }

        if (!car.imei && !car.imeiPhoto) {
          await transaction.rollback();
          return next(
            ApiError.badRequest(
              `Автомобиль ${index + 1}: необходимо указать IMEI или загрузить фото IMEI`,
            ),
          );
        }

        if (!car.equipment || car.equipment.length === 0) {
          await transaction.rollback();
          return next(
            ApiError.badRequest(
              `Автомобиль ${index + 1}: необходимо добавить оборудование`,
            ),
          );
        }

        for (const [eqIndex, eq] of car.equipment.entries()) {
          if (!eq.name || !eq.serialNumber) {
            await transaction.rollback();
            return next(
              ApiError.badRequest(
                `Автомобиль ${index + 1}, оборудование ${eqIndex + 1}: заполните все поля`,
              ),
            );
          }
        }
      }

      // Создаем запись о завершении
      const completion = await ApplicationCompletion.create(
        {
          applicationId: id,
          equipment: parsedEquipment, // Для обратной совместимости
          cars: parsedCars, // Новая структура
          actSigned: JSON.parse(actSigned),
          completionComment: completionComment || null,
        },
        { transaction },
      );

      // Обрабатываем фото
      const files = Array.isArray(req.files.photos)
        ? req.files.photos
        : [req.files.photos];

      const photos = [];

      // Создаем мапу для сопоставления фото с carId и photoType
      // Для этого нам нужно, чтобы клиент отправлял метаданные для каждого фото
      // Например, в отдельном поле photoMetadata
      let photoMetadata = [];
      if (req.body.photoMetadata) {
        try {
          photoMetadata = JSON.parse(req.body.photoMetadata);
        } catch (e) {
          console.warn("Ошибка парсинга photoMetadata", e);
        }
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
        const uploadPath = path.resolve(
          __dirname,
          "..",
          "static",
          "uploads",
          uniqueName,
        );

        await file.mv(uploadPath);

        const photoRecord = {
          completionId: completion.id,
          path: "/uploads/" + uniqueName,
        };

        // Если есть метаданные для этого фото, добавляем carId и photoType
        if (photoMetadata[i]) {
          photoRecord.carId = photoMetadata[i].carId;
          photoRecord.photoType = photoMetadata[i].photoType || "car";
        }

        photos.push(photoRecord);
      }

      await ApplicationPhoto.bulkCreate(photos, { transaction });

      if(sendType == 'default'){
        console.log(true);
        await application.update({ status: "review" }, { transaction });
      }

      await transaction.commit();

      return res.json({
        success: true,
        completion,
        message: "Работа успешно сдана на проверку",
      });
    } catch (e) {
      await transaction.rollback();

      // Удаляем загруженные файлы при ошибке
      if (req.files?.photos) {
        const files = Array.isArray(req.files.photos)
          ? req.files.photos
          : [req.files.photos];

        for (const file of files) {
          try {
            const fullPath = path.resolve(
              process.cwd(),
              "static",
              "uploads",
              file.name,
            );
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          } catch (unlinkError) {
            console.error("Ошибка при удалении файла:", unlinkError);
          }
        }
      }

      console.error("Ошибка при сдаче работы:", e);
      return next(ApiError.internal("Ошибка при сдаче работы"));
    }
  }
}

module.exports = new ApplicationController();

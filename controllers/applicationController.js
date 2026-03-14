const path = require("path");
const fs = require("fs");
const ApiError = require("../error/ApiError");
const {
  Application,
  User,
  ApplicationCompletion,
  ApplicationPhoto,
  Chat,
  Message,
  PushToken,
  ApplicationCompletionEquipment,
  ApplicationCompletionPhoto,
} = require("../models/model");
const sequelize = require("../db");
const { sendPush } = require("../services/push.service");

async function deleteFileIfExists(filePath) {
  if (!filePath) return;
  // Предполагается, что в БД путь хранится как "/uploads/...", а физически файл лежит в "static/uploads"
  const fullPath = path.join(__dirname, "../static", filePath);
  try {
    await fs.access(fullPath);
    await fs.unlink(fullPath);
  } catch (err) {
    // файла нет – игнорируем
  }
}

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

      const tokens = await PushToken.findAll({
        where: { userId },
        attributes: ["token"],
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

        await sendPush(
          tokens.map((t) => t.token),
          "Новая заявка",
          "У вас появилась новая заявка на работу",
          {
            screen: `/(tabs)/applications`,
          },
        );

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

      await sendPush(
        tokens.map((t) => t.token),
        "Новая заявка",
        "У вас появилась новая заявка на работу",
        {
          screen: `/(tabs)/applications`,
        },
      );

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
              include: [
                { model: ApplicationCompletionEquipment },
                { model: ApplicationCompletionPhoto },
              ],
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
          {
            model: ApplicationCompletion,
            include: [
              {
                model: ApplicationCompletionEquipment,
                as: "equipments",
              },
              { model: ApplicationCompletionPhoto, as: "photos" },
            ],
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
            include: [
              {
                model: ApplicationCompletionEquipment,
                as: "equipments",
              },
              { model: ApplicationCompletionPhoto, as: "photos" },
            ],
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
        {
          model: ApplicationCompletion,
          include: [
            {
              model: ApplicationCompletionEquipment,
              as: "equipments",
            },
            { model: ApplicationCompletionPhoto, as: "photos" },
          ],
        },
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

        const tokens = await PushToken.findAll({
          where: { userId: user.id },
          attributes: ["token"],
        });

        if (status === "in_progress") {
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

        await sendPush(
          tokens.map((t) => t.token),
          "Заявка отклонена",
          "Заявка отклонена со стороны диспетчеров",
          {
            screen: `/(tabs)/applications`,
          },
        );

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
    try {
      const { id } = req.params; // applicationId
      const { brand, stateNumber, sendType } = req.body;

      if (!brand || !stateNumber) {
        return next(ApiError.badRequest("Не указаны марка или госномер"));
      }

      // --- Сбор оборудования из req.body ---
      const equipmentMap = {};

      Object.keys(req.body).forEach((key) => {
        const match = key.match(/^equipment\[(\d+)\]\.(.+)$/);
        if (match) {
          const index = match[1];
          const field = match[2];
          if (field === "equipment" || field === "imei") {
            if (!equipmentMap[index]) equipmentMap[index] = {};
            equipmentMap[index][field] = req.body[key];
          }
        }
      });

      // --- Подготовка к перемещению файлов ---
      const movePromises = [];

      // Обработка файлов imeiPhoto
      if (req.files) {
        Object.keys(req.files).forEach((key) => {
          const match = key.match(/^equipment\[(\d+)\]\.imeiPhoto$/);
          if (match) {
            const index = match[1];
            const file = req.files[key]; // это один файл
            if (!equipmentMap[index]) equipmentMap[index] = {};

            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
            const uploadPath = `static/uploads/${fileName}`;

            const movePromise = new Promise((resolve, reject) => {
              file.mv(uploadPath, (err) => {
                if (err) reject(err);
                else resolve({ index, fileName });
              });
            });
            movePromises.push(movePromise);
          }
        });
      }

      // Обработка фотографий автомобиля (photos)
      let photoFiles = [];
      if (req.files && req.files.photos) {
        photoFiles = Array.isArray(req.files.photos)
          ? req.files.photos
          : [req.files.photos];
      }

      if (photoFiles.length === 0) {
        return next(ApiError.badRequest("Не загружены фотографии автомобиля"));
      }

      const photoMovePromises = photoFiles.map((file, idx) => {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
        const uploadPath = `static/uploads/${fileName}`;
        return new Promise((resolve, reject) => {
          file.mv(uploadPath, (err) => {
            if (err) reject(err);
            else resolve(fileName);
          });
        });
      });

      // Ждём перемещения всех файлов
      const [imeiResults, photoFileNames] = await Promise.all([
        Promise.all(movePromises),
        Promise.all(photoMovePromises),
      ]);

      // Обновляем equipmentMap именами сохранённых imeiPhoto
      imeiResults.forEach(({ index, fileName }) => {
        if (equipmentMap[index]) {
          equipmentMap[index].imeiPhoto = fileName;
        }
      });

      // Преобразуем equipmentMap в массив
      const equipmentArray = Object.keys(equipmentMap)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((idx) => equipmentMap[idx]);

      // --- Создание записи завершения ---
      const completion = await ApplicationCompletion.create({
        brand,
        stateNumber,
        applicationId: id,
      });

      // --- Сохранение оборудования ---
      for (const eq of equipmentArray) {
        if (!eq.equipment) continue; // пропускаем незаполненное оборудование
        await ApplicationCompletionEquipment.create({
          equipment: eq.equipment,
          imei: eq.imei || null,
          imeiPhoto: `/uploads/${eq.imeiPhoto}` || null,
          completionId: completion.id,
        });
      }

      // --- Сохранение фотографий автомобиля ---
      for (const fileName of photoFileNames) {
        await ApplicationCompletionPhoto.create({
          path: `/uploads/${fileName}`,
          completionId: completion.id,
        });
      }

      if (sendType == "default") {
        await Application.update({ status: "review" }, { where: { id } });
      }

      return res.json({ success: true, completionId: completion.id });
    } catch (err) {
      console.error(err);
      return next(ApiError.badRequest(err.message));
    }
  }
  async updateCompleteApplication(req, res, next) {
    try {
      const { completionId } = req.params;
      const { brand, stateNumber, sendType } = req.body;

      if (!brand || !stateNumber) {
        return next(ApiError.badRequest("Не указаны марка или госномер"));
      }

      const completion = await ApplicationCompletion.findByPk(completionId, {
        include: [
          { model: ApplicationCompletionEquipment, as: "equipments" },
          { model: ApplicationCompletionPhoto, as: "photos" },
        ],
      });

      if (!completion) {
        return next(ApiError.notFound("Завершение не найдено"));
      }

      // 1. Обновляем основные поля
      await completion.update({ brand, stateNumber });

      // 2. Обработка фото автомобиля
      let existingPhotoIds = req.body.existingPhotos;
      if (existingPhotoIds && !Array.isArray(existingPhotoIds)) {
        existingPhotoIds = [existingPhotoIds];
      }
      existingPhotoIds = existingPhotoIds || [];

      // Удаляем фото, которых нет в списке существующих
      const photosToDelete = completion.photos.filter(
        (p) => !existingPhotoIds.includes(p.id),
      );
      for (const photo of photosToDelete) {
        await deleteFileIfExists(photo.path);
        await photo.destroy();
      }

      // Добавляем новые фото из файлов
      let photoFiles = [];
      if (req.files && req.files.photos) {
        photoFiles = Array.isArray(req.files.photos)
          ? req.files.photos
          : [req.files.photos];
      }
      for (const file of photoFiles) {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
        const uploadPath = `static/uploads/${fileName}`;
        await new Promise((resolve, reject) => {
          file.mv(uploadPath, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await ApplicationCompletionPhoto.create({
          path: `/uploads/${fileName}`,
          completionId: completion.id,
        });
      }

      // 3. Обработка оборудования
      // Собираем данные из тела
      const equipmentMap = {};
      Object.keys(req.body).forEach((key) => {
        const match = key.match(/^equipment\[(\d+)\]\.(.+)$/);
        if (match) {
          const index = match[1];
          const field = match[2];
          if (!equipmentMap[index]) equipmentMap[index] = {};
          equipmentMap[index][field] = req.body[key];
        }
      });

      // Собираем файлы imeiPhoto
      const imeiPhotoFiles = {};
      if (req.files) {
        Object.keys(req.files).forEach((key) => {
          const match = key.match(/^equipment\[(\d+)\]\.imeiPhoto$/);
          if (match) {
            const index = match[1];
            imeiPhotoFiles[index] = req.files[key];
          }
        });
      }

      // Обрабатываем каждую запись оборудования
      for (const [idxStr, eqData] of Object.entries(equipmentMap)) {
        const index = parseInt(idxStr);
        const equipmentId = eqData.id; // id существующего оборудования (если есть)
        let equipment;

        if (equipmentId) {
          // Найти существующее оборудование
          equipment = completion.equipments.find((e) => e.id === equipmentId);
          if (!equipment) continue; // на всякий случай пропускаем
          // Обновляем текстовые поля
          await equipment.update({
            equipment: eqData.equipment || "",
            imei: eqData.imei || null,
          });
        } else {
          // Создаём новое оборудование
          equipment = await ApplicationCompletionEquipment.create({
            equipment: eqData.equipment || "",
            imei: eqData.imei || null,
            completionId: completion.id,
          });
        }

        // Обработка imeiPhoto
        const imeiPhotoFile = imeiPhotoFiles[index];
        const imeiPhotoId = eqData.imeiPhotoId;

        if (imeiPhotoFile) {
          // Пришёл новый файл – заменяем старый (если есть)
          if (equipment.imeiPhoto) {
            await deleteFileIfExists(equipment.imeiPhoto);
          }
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${imeiPhotoFile.name}`;
          const uploadPath = `static/uploads/${fileName}`;
          await new Promise((resolve, reject) => {
            imeiPhotoFile.mv(uploadPath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          await equipment.update({ imeiPhoto: `/uploads/${fileName}` });
        } else if (imeiPhotoId) {
          // Передан id существующего фото – ничего не меняем
          // Можно дополнительно проверить, что id совпадает с текущим, но это необязательно
        } else {
          // Ни файла, ни id – значит фото удалено
          if (equipment.imeiPhoto) {
            await deleteFileIfExists(equipment.imeiPhoto);
            await equipment.update({ imeiPhoto: null });
          }
        }
      }

      // Удаляем оборудование, которое не было упомянуто в запросе
      const processedEquipmentIds = Object.values(equipmentMap)
        .map((eq) => eq.id)
        .filter((id) => id);
      const equipmentToDelete = completion.equipments.filter(
        (eq) => !processedEquipmentIds.includes(eq.id),
      );
      for (const eq of equipmentToDelete) {
        if (eq.imeiPhoto) {
          await deleteFileIfExists(eq.imeiPhoto);
        }
        await eq.destroy();
      }

      // Если sendType == "default" – меняем статус заявки
      if (sendType === "default") {
        await Application.update(
          { status: "review" },
          { where: { id: completion.applicationId } },
        );
      }

      return res.json({ success: true, completionId: completion.id });
    } catch (err) {
      console.error(err);
      return next(ApiError.badRequest(err.message));
    }
  }
  async deleteCompleteApplication(req, res, next) {
    try {
      const { completionId } = req.params;
      const completion = await ApplicationCompletion.findByPk(completionId, {
        include: [
          { model: ApplicationCompletionEquipment, as: "equipments" },
          { model: ApplicationCompletionPhoto, as: "photos" },
        ],
      });
      if (!completion) {
        return next(ApiError.notFound("Завершение не найдено"));
      }

      // Удаление файлов фото
      for (const photo of completion.photos) {
        await deleteFileIfExists(photo.path);
      }
      // Удаление файлов imeiPhoto
      for (const eq of completion.equipments) {
        if (eq.imeiPhoto) {
          await deleteFileIfExists(eq.imeiPhoto);
        }
      }

      await completion.destroy();
      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new ApplicationController();

const path = require("path");
const fs = require("fs");
const ApiError = require("../error/ApiError");
const {
  Application,
  User,
  ApplicationCompletion,
  Chat,
  Message,
  PushToken,
  ApplicationCompletionEquipment,
  ApplicationCompletionPhoto,
} = require("../models/model");
const sequelize = require("../db");
const { sendPush } = require("../services/push.service");
const imagekit = require("../config/imagekit");

async function uploadToImageKit(file, folder = "uploads") {
  try {
    // Генерируем уникальное имя файла
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;

    // Загружаем файл в ImageKit
    const result = await imagekit.upload({
      file: file.data, // buffer данных файла
      fileName: fileName,
      folder: `/${folder}`,
      useUniqueFileName: false, // мы уже сгенерировали уникальное имя
    });

    return {
      fileId: result.fileId,
      url: result.url,
      filePath: result.filePath,
      fileName: fileName,
    };
  } catch (error) {
    console.error("Ошибка загрузки в ImageKit:", error);
    throw error;
  }
}

// Вспомогательная функция для удаления из ImageKit
async function deleteFromImageKit(fileId) {
  try {
    if (fileId) {
      await imagekit.deleteFile(fileId);
    }
  } catch (error) {
    console.error("Ошибка удаления из ImageKit:", error);
    // Не выбрасываем ошибку, чтобы не прерывать основной процесс
  }
}

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
                { model: ApplicationCompletionEquipment, as: "equipments" },
                { model: ApplicationCompletionPhoto, as: "photos" },
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

      const tokens = await PushToken.findAll({
        where: { userId },
        attributes: ["token"],
      });

      await sendPush(
        tokens.map((t) => t.token),
        `Заявка отклонена`,
        "Менеджер отклонил заявку",
        {
          screen: `/(tabs)/applications`,
        },
      );

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
      const { comment } = req.body;
      const user = req.user;

      const application = await Application.findOne({ where: { id } });

      if (!application) {
        return next(ApiError.badRequest("Заявка не найдена"));
      }

      const tokens = await PushToken.findAll({
        where: { userId: application.userId },
        attributes: ["token"],
      });
      const pushTokens = tokens.map((t) => t.token);

      const notifications = {
        accepted: {
          title: "🎉 Заявка принята",
          message: "Теперь вы можете связаться с клиентом.",
        },
        in_progress: {
          title: "🔥 Заявка в работе",
          message: "Работа началась. Можете продолжить выполнение.",
        },
        completed: {
          title: "✅ Работа завершена",
          message: "Работа успешно выполнена.",
        },
        review: {
          title: "🔍 Работа на проверке",
          message: "Заявка отправлена на проверку.",
        },
        rejected: {
          title: "❌ Заявка отклонена",
          message: "К сожалению, работа была отклонена.",
        },
      };

      // ADMIN логика
      if (user.role === "ADMIN") {
        if (status === "in_progress") {
          if (!comment || !comment.trim()) {
            return next(
              ApiError.badRequest(
                "Укажите комментарий, чтобы вернуть заявку на доработку",
              ),
            );
          }

          application.returnComment = comment;
        }
      } else {
        // Проверка что заявка принадлежит пользователю
        if (application.userId !== user.id) {
          return next(ApiError.forbidden("Нет доступа к этой заявке"));
        }
      }

      // Отправка push
      const notification = notifications[status];

      if (notification && pushTokens.length) {
        await sendPush(pushTokens, notification.title, notification.message, {
          screen: "/(tabs)/applications",
        });
      }

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
      const { brand, stateNumber, completionComment, actSigned, sendType } =
        req.body;

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

      // --- Подготовка к загрузке в ImageKit ---
      const uploadPromises = [];

      // Обработка файлов imeiPhoto
      if (req.files) {
        Object.keys(req.files).forEach((key) => {
          const match = key.match(/^equipment\[(\d+)\]\.imeiPhoto$/);
          if (match) {
            const index = match[1];
            const file = req.files[key]; // это один файл
            if (!equipmentMap[index]) equipmentMap[index] = {};

            const uploadPromise = uploadToImageKit(file, "imei-photos").then(
              (result) => ({
                index,
                fileId: result.fileId,
                url: result.url,
                filePath: result.filePath,
              }),
            );
            uploadPromises.push(uploadPromise);
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

      const photoUploadPromises = photoFiles.map((file) =>
        uploadToImageKit(file, "car-photos"),
      );

      // Ждём загрузки всех файлов в ImageKit
      const [imeiResults, photoResults] = await Promise.all([
        Promise.all(uploadPromises),
        Promise.all(photoUploadPromises),
      ]);

      // Обновляем equipmentMap данными из ImageKit
      imeiResults.forEach(({ index, fileId, url, filePath }) => {
        if (equipmentMap[index]) {
          equipmentMap[index].imeiPhoto = url;
          equipmentMap[index].imeiPhotoFileId = fileId;
          equipmentMap[index].imeiPhotoPath = filePath;
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
          imeiPhoto: eq.imeiPhoto || null,
          imeiPhotoFileId: eq.imeiPhotoFileId || null,
          completionId: completion.id,
        });
      }

      // --- Сохранение фотографий автомобиля ---
      for (const photo of photoResults) {
        await ApplicationCompletionPhoto.create({
          path: photo.url,
          fileId: photo.fileId,
          filePath: photo.filePath,
          completionId: completion.id,
        });
      }

      const userId = req.user.id;

      const tokens = await PushToken.findAll({
        where: { userId },
        attributes: ["token"],
      });

      if (sendType == "default") {
        await Application.update({ status: "review" }, { where: { id } });
        await sendPush(
          tokens.map((t) => t.token),
          `🎉 Заявка на рассмотрении`,
          "Ваша работа на рассмотрении",
          {
            screen: `/(tabs)/applications`,
          },
        );
      }

      await Application.update(
        { completionComment, actSigned },
        { where: { id: completion.applicationId } },
      );

      return res.json({ success: true, completionId: completion.id });
    } catch (err) {
      console.error(err);
      return next(ApiError.badRequest(err.message));
    }
  }

  async updateCompleteApplication(req, res, next) {
    try {
      const { completionId } = req.params;
      const { brand, stateNumber, completionComment, actSigned, sendType } =
        req.body;

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
        // Удаляем из ImageKit
        if (photo.fileId) {
          await deleteFromImageKit(photo.fileId);
        }
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
        const result = await uploadToImageKit(file, "car-photos");
        await ApplicationCompletionPhoto.create({
          path: result.url,
          fileId: result.fileId,
          filePath: result.filePath,
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
          if (equipment.imeiPhotoFileId) {
            await deleteFromImageKit(equipment.imeiPhotoFileId);
          }

          const result = await uploadToImageKit(imeiPhotoFile, "imei-photos");
          await equipment.update({
            imeiPhoto: result.url,
            imeiPhotoFileId: result.fileId,
            imeiPhotoPath: result.filePath,
          });
        } else if (imeiPhotoId) {
          // Передан id существующего фото – ничего не меняем
        } else {
          // Ни файла, ни id – значит фото удалено
          if (equipment.imeiPhotoFileId) {
            await deleteFromImageKit(equipment.imeiPhotoFileId);
            await equipment.update({
              imeiPhoto: null,
              imeiPhotoFileId: null,
              imeiPhotoPath: null,
            });
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
        if (eq.imeiPhotoFileId) {
          await deleteFromImageKit(eq.imeiPhotoFileId);
        }
        await eq.destroy();
      }

      const userId = req.user.id;

      const tokens = await PushToken.findAll({
        where: { userId },
        attributes: ["token"],
      });

      await Application.update(
        { completionComment, actSigned },
        { where: { id: completion.applicationId } },
      );

      if (sendType === "default") {
        await Application.update(
          { status: "review" },
          { where: { id: completion.applicationId } },
        );

        await sendPush(
          tokens.map((t) => t.token),
          `🎉 Заявка на рассмотрении`,
          "Ваша работа на рассмотрении",
          {
            screen: `/(tabs)/applications`,
          },
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

      // Удаление файлов из ImageKit
      const deletePromises = [];

      // Удаление фото автомобиля
      for (const photo of completion.photos) {
        if (photo.fileId) {
          deletePromises.push(deleteFromImageKit(photo.fileId));
        }
      }

      // Удаление imeiPhoto
      for (const eq of completion.equipments) {
        if (eq.imeiPhotoFileId) {
          deletePromises.push(deleteFromImageKit(eq.imeiPhotoFileId));
        }
      }

      // Ждем удаления всех файлов
      await Promise.all(deletePromises);

      // Удаляем запись из БД
      await completion.destroy();

      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new ApplicationController();

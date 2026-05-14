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

const removeDir = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
};

// Вспомогательная функция для сохранения файла и возврата относительного пути
const saveFileLocally = async (
  file,
  applicationId,
  completionId,
  subfolder = "",
) => {
  const uploadDir = path.resolve(
    __dirname,
    "..",
    "static",
    "uploads",
    applicationId,
    completionId,
    subfolder,
  );
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const ext = path.extname(file.name);
  const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
  const filePath = path.join(uploadDir, uniqueName);
  await file.mv(filePath);
  // Возвращаем путь относительно static
  return path
    .join("uploads", applicationId, completionId, subfolder, uniqueName)
    .replace(/\\/g, "/");
};

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
          order: [["createdAt", "DESC"]],
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
        order: [["createdAt", "DESC"]],
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
        approved: {
          title: "✅ Заявка одобрена",
          message: "Работа одобрена.",
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
      const {
        brand,
        stateNumber,
        completionComment,
        additionalWork,
        actSigned,
        sendType,
      } = req.body;

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

      // --- Получение файлов фотографий автомобиля ---
      let photoFiles = [];
      if (req.files && req.files.photos) {
        photoFiles = Array.isArray(req.files.photos)
          ? req.files.photos
          : [req.files.photos];
      }
      if (photoFiles.length === 0) {
        return next(ApiError.badRequest("Не загружены фотографии автомобиля"));
      }

      // --- Создание записи завершения (чтобы получить completionId) ---
      const completion = await ApplicationCompletion.create({
        brand,
        stateNumber,
        applicationId: id,
      });

      const completionId = completion.id.toString();

      // --- Сохранение фотографий автомобиля локально ---
      const photoPaths = [];
      for (const file of photoFiles) {
        const relativePath = await saveFileLocally(
          file,
          id,
          completionId,
          "photos",
        );
        photoPaths.push(relativePath);
      }

      // Сохраняем записи фото в БД
      for (const pPath of photoPaths) {
        await ApplicationCompletionPhoto.create({
          path: pPath, // относительный путь
          completionId: completion.id,
        });
      }

      // --- Обработка оборудования ---
      const equipmentArray = Object.keys(equipmentMap)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((idx) => equipmentMap[idx]);

      for (const eq of equipmentArray) {
        if (!eq.equipment) continue;

        // Обработка imeiPhoto для текущего оборудования
        let imeiPhotoPath = null;
        const imeiPhotoFile =
          req.files && req.files[`equipment[${eq.index}]?.imeiPhoto`]; // индекс из цикла не сохранился, нужно переделать

        // Чтобы сопоставить файлы, переберём ключи req.files
        const imeiPhotoKey = Object.keys(req.files || {}).find(
          (k) =>
            k.startsWith(`equipment[${equipmentArray.indexOf(eq)}]`) &&
            k.endsWith(".imeiPhoto"),
        );
        const imeiFile = imeiPhotoKey ? req.files[imeiPhotoKey] : null;

        if (imeiFile) {
          imeiPhotoPath = await saveFileLocally(
            imeiFile,
            id,
            completionId,
            "imei",
          );
        }

        await ApplicationCompletionEquipment.create({
          equipment: eq.equipment,
          imei: eq.imei || null,
          imeiPhoto: imeiPhotoPath, // относительный путь
          completionId: completion.id,
        });
      }

      // --- Пуш-уведомления и обновление статуса (без изменений) ---
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
          { screen: `/(tabs)/applications` },
        );
      }

      await Application.update(
        { completionComment, additionalWork, actSigned },
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
      const {
        brand,
        stateNumber,
        completionComment,
        additionalWork,
        actSigned,
        sendType,
      } = req.body;

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

      const applicationId = completion.applicationId.toString();
      const compId = completion.id.toString();

      // 1. Обновляем основные поля
      await completion.update({ brand, stateNumber });

      // 2. Обработка фото автомобиля
      let existingPhotoIds = req.body.existingPhotos;
      if (existingPhotoIds && !Array.isArray(existingPhotoIds)) {
        existingPhotoIds = [existingPhotoIds];
      }
      existingPhotoIds = existingPhotoIds || [];

      // Удаляем фото, которых нет в списке (и их файлы)
      const photosToDelete = completion.photos.filter(
        (p) => !existingPhotoIds.includes(p.id),
      );
      for (const photo of photosToDelete) {
        // Удаляем файл с диска
        const fullPath = path.resolve(__dirname, "..", "static", photo.path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
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
        const relativePath = await saveFileLocally(
          file,
          applicationId,
          compId,
          "photos",
        );
        await ApplicationCompletionPhoto.create({
          path: relativePath,
          completionId: completion.id,
        });
      }

      // 3. Обработка оборудования
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
            imeiPhotoFiles[match[1]] = req.files[key];
          }
        });
      }

      // Обрабатываем каждую запись оборудования
      for (const [idxStr, eqData] of Object.entries(equipmentMap)) {
        const index = parseInt(idxStr);
        const equipmentId = eqData.id;
        let equipment;

        if (equipmentId) {
          equipment = completion.equipments.find((e) => e.id === equipmentId);
          if (!equipment) continue;
          await equipment.update({
            equipment: eqData.equipment || "",
            imei: eqData.imei || null,
          });
        } else {
          equipment = await ApplicationCompletionEquipment.create({
            equipment: eqData.equipment || "",
            imei: eqData.imei || null,
            completionId: completion.id,
          });
        }

        // Обработка imeiPhoto
        const imeiFile = imeiPhotoFiles[idxStr];
        const existingImeiPhotoId = eqData.imeiPhotoId; // если передали id существующего фото (но теперь это не нужно, т.к. путь хранится в equipment.imeiPhoto)

        if (imeiFile) {
          // Удаляем старый файл, если был
          if (equipment.imeiPhoto) {
            const oldPath = path.resolve(
              __dirname,
              "..",
              "static",
              equipment.imeiPhoto,
            );
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
          // Сохраняем новый
          const relativePath = await saveFileLocally(
            imeiFile,
            applicationId,
            compId,
            "imei",
          );
          await equipment.update({ imeiPhoto: relativePath });
        } else if (existingImeiPhotoId) {
          // Оставляем без изменений
        } else {
          // Удаляем существующее фото, если оно было
          if (equipment.imeiPhoto) {
            const oldPath = path.resolve(
              __dirname,
              "..",
              "static",
              equipment.imeiPhoto,
            );
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            await equipment.update({ imeiPhoto: null });
          }
        }
      }

      // Удаление оборудования, не упомянутого в запросе
      const processedEquipmentIds = Object.values(equipmentMap)
        .map((eq) => eq.id)
        .filter((id) => id);
      const equipmentToDelete = completion.equipments.filter(
        (eq) => !processedEquipmentIds.includes(eq.id),
      );
      for (const eq of equipmentToDelete) {
        // Удаляем связанный imeiPhoto с диска
        if (eq.imeiPhoto) {
          const photoPath = path.resolve(
            __dirname,
            "..",
            "static",
            eq.imeiPhoto,
          );
          if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
        }
        await eq.destroy();
      }

      // Пуш и обновление заявки
      const userId = req.user.id;
      const tokens = await PushToken.findAll({
        where: { userId },
        attributes: ["token"],
      });

      await Application.update(
        { completionComment, additionalWork, actSigned },
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
          { screen: `/(tabs)/applications` },
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

      const applicationId = completion.applicationId.toString();
      const compId = completion.id.toString();

      // Удаляем всю папку с файлами
      const uploadDir = path.resolve(
        __dirname,
        "..",
        "static",
        "uploads",
        applicationId,
        compId,
      );
      removeDir(uploadDir);

      // Удаляем запись из БД (каскадно удалятся equipment и photos, но файлы уже удалены)
      await completion.destroy();

      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return next(ApiError.badRequest(err.message));
    }
  }
  async uploadQrCode(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;

      // Проверяем права доступа (только ADMIN или владелец заявки)
      const application = await Application.findOne({ where: { id } });

      if (!application) {
        return next(ApiError.notFound("Заявка не найдена"));
      }

      // Проверка прав: только ADMIN или пользователь, создавший заявку
      if (user.role !== "ADMIN" && application.userId !== user.id) {
        return next(ApiError.forbidden("Нет доступа к этой заявке"));
      }

      // Проверяем наличие файла
      if (!req.files || !req.files.qrCode) {
        return next(ApiError.badRequest("Файл QR-кода не загружен"));
      }

      const qrFile = req.files.qrCode;

      // Проверка типа файла
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
      ];
      if (!allowedTypes.includes(qrFile.mimetype)) {
        return next(
          ApiError.badRequest(
            "Неверный формат файла. Поддерживаются: JPEG, PNG, WEBP",
          ),
        );
      }

      // Проверка размера (максимум 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (qrFile.size > maxSize) {
        return next(
          ApiError.badRequest("Размер файла не должен превышать 5MB"),
        );
      }

      // Удаляем старый QR-код, если есть
      if (application.qrCode) {
        const oldQrPath = path.resolve(
          __dirname,
          "..",
          "static",
          application.qrCode,
        );
        if (fs.existsSync(oldQrPath)) {
          fs.unlinkSync(oldQrPath);
        }
      }

      // Создаем директорию для QR-кодов
      const qrUploadDir = path.resolve(
        __dirname,
        "..",
        "static",
        "uploads",
        id.toString(),
        "qrcode",
      );
      if (!fs.existsSync(qrUploadDir)) {
        fs.mkdirSync(qrUploadDir, { recursive: true });
      }

      // Сохраняем файл
      const ext = path.extname(qrFile.name);
      const uniqueName = `qr_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(qrUploadDir, uniqueName);
      await qrFile.mv(filePath);

      // Относительный путь для сохранения в БД
      const relativePath = path
        .join("uploads", id.toString(), "qrcode", uniqueName)
        .replace(/\\/g, "/");

      // Обновляем запись в БД
      application.qrCode = relativePath;
      await application.save();

      return res.json({
        success: true,
        message: "QR-код успешно загружен",
        qrCode: relativePath,
      });
    } catch (err) {
      console.error(err);
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new ApplicationController();

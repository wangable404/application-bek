const sequelize = require("../db");
const { DataTypes } = require("sequelize");

const User = sequelize.define("users", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  firstName: {
    type: DataTypes.STRING,
  },
  lastName: {
    type: DataTypes.STRING,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: "USER",
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  emailCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  emailCodeExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

const Application = sequelize.define("applications", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    unique: true,
  },
  dealId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(
      "pending",
      "accepted",
      "in_progress",
      "review",
      "completed",
      "approved",
      "rejected",
    ),
    defaultValue: "pending",
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clientBio: {
    type: DataTypes.STRING,
  },
  clientPhone: {
    type: DataTypes.STRING,
  },
  city: {
    type: DataTypes.STRING,
  },
  type: {
    type: DataTypes.STRING,
  },
  carQuantity: {
    type: DataTypes.STRING,
  },
  carBrand: {
    type: DataTypes.STRING,
  },
  comment: {
    type: DataTypes.STRING,
  },
  allCarQuantity: {
    type: DataTypes.STRING,
  },
  forFreight: {
    type: DataTypes.STRING,
  },
  forCars: {
    type: DataTypes.STRING,
  },
  freightBrand: {
    type: DataTypes.STRING,
  },
  relay: {
    type: DataTypes.STRING,
  },
  products: {
    type: DataTypes.STRING,
  },
  priceStreet: {
    type: DataTypes.STRING,
  },
  agreedDate: {
    type: DataTypes.DATEONLY,
  },
  startWorkComment: {
    type: DataTypes.TEXT,
  },
  workType: {
    type: DataTypes.ENUM(
      "service", // Сервисные работы
      "transition", // Переход
      "installation", // Установка
    ),
    defaultValue: "installation",
    comment: "Тип работ",
  },
  returnComment: {
    type: DataTypes.TEXT,
    comment: "Комментарий при возврате на доработку",
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: false,
  },
});

const ApplicationCompletion = sequelize.define("application_completions", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },

  cars: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: "Массив автомобилей с их оборудованием и фото",
  },

  equipment: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: "Для обратной совместимости - все оборудование плоским списком",
  },

  actSigned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  completionComment: {
    type: DataTypes.TEXT,
    comment: "Комментарий при сдаче работы",
  },

  applicationId: {
    type: DataTypes.INTEGER,
    references: {
      model: Application,
      key: "id",
    },
    allowNull: false,
  },
});

const ApplicationPhoto = sequelize.define("application_photos", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },

  path: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  completionId: {
    type: DataTypes.UUID,
    references: {
      model: ApplicationCompletion,
      key: "id",
    },
    allowNull: false,
  },
  
  carId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "ID автомобиля из cars массива, к которому относится фото",
  },
  
  photoType: {
    type: DataTypes.ENUM('car', 'imei'),
    defaultValue: 'car',
    comment: "Тип фото: обычное или IMEI",
  },
});

const Chat = sequelize.define("chats", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  applicationId: {
    type: DataTypes.INTEGER,
    references: {
      model: Application,
      key: "id",
    },
    allowNull: false,
    unique: true,
  },
  archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  archivedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  archivedBy: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: true,
  },
});

const Message = sequelize.define(
  "messages",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    text: {
      type: DataTypes.STRING,
    },
    chatId: {
      type: DataTypes.UUID,
      references: {
        model: Chat,
        key: "id",
      },
      allowNull: false,
    },
    senderId: {
      type: DataTypes.UUID,
      references: {
        model: User,
        key: "id",
      },
      allowNull: false,
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { timestamps: true },
);

User.hasMany(Application, { foreignKey: "userId" });
Application.belongsTo(User, { foreignKey: "userId" });

Application.hasMany(ApplicationCompletion, {
  foreignKey: "applicationId",
});

ApplicationCompletion.belongsTo(Application, {
  foreignKey: "applicationId",
});

ApplicationCompletion.hasMany(ApplicationPhoto, {
  foreignKey: "completionId",
});

ApplicationPhoto.belongsTo(ApplicationCompletion, {
  foreignKey: "completionId",
});

Application.hasOne(Chat, { foreignKey: "applicationId" });
Chat.belongsTo(Application, { foreignKey: "applicationId" });

Chat.hasMany(Message, { foreignKey: "chatId" });
Message.belongsTo(Chat, { foreignKey: "chatId" });

User.hasMany(Message, { foreignKey: "senderId" });
Message.belongsTo(User, { foreignKey: "senderId" });

module.exports = {
  User,
  Application,
  ApplicationCompletion,
  ApplicationPhoto,
  Chat,
  Message,
};

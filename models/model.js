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
  phone: {
    type: DataTypes.STRING,
  },
  city: {
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

const PushToken = sequelize.define("push_tokens", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
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
    type: DataTypes.TEXT,
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
    type: DataTypes.STRING,
  },
  startWorkComment: {
    type: DataTypes.TEXT,
  },
  workType: {
    type: DataTypes.ENUM(
      "service", //  Сервисные работы
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
  completionComment: {
    type: DataTypes.TEXT,
    comment: "Комментарий при завершении работы",
  },
  actSigned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  brand: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  stateNumber: {
    type: DataTypes.STRING,
    allowNull: false,
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

const ApplicationCompletionEquipment = sequelize.define(
  "application_completion_equipments",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    equipment: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    imei: {
      type: DataTypes.STRING,
    },
    imeiPhoto: {
      type: DataTypes.STRING,
    },
    completionId: {
      type: DataTypes.UUID,
      references: {
        model: ApplicationCompletion,
        key: "id",
      },
      allowNull: false,
    },
  },
);

const ApplicationCompletionPhoto = sequelize.define(
  "application_completion_photos",
  {
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
  },
);

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

User.hasMany(PushToken, { foreignKey: "userId" });
PushToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Application, { foreignKey: "userId" });
Application.belongsTo(User, { foreignKey: "userId" });

Application.hasMany(ApplicationCompletion, {
  foreignKey: "applicationId",
});

ApplicationCompletion.belongsTo(Application, {
  foreignKey: "applicationId",
});

ApplicationCompletion.hasMany(ApplicationCompletionEquipment, {
  as: "equipments",
  foreignKey: "completionId",
});

ApplicationCompletionEquipment.belongsTo(ApplicationCompletion, {
  foreignKey: "completionId",
});

ApplicationCompletion.hasMany(ApplicationCompletionPhoto, {
  as: "photos",
  foreignKey: "completionId",
});

ApplicationCompletionPhoto.belongsTo(ApplicationCompletion, {
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
  PushToken,
  Application,
  ApplicationCompletion,
  ApplicationCompletionEquipment,
  ApplicationCompletionPhoto,
  Chat,
  Message,
};

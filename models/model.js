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
  description: {
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
  balance: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  trialEndsAt: {
    type: DataTypes.DATE,
    allowNull: true,
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
  planId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: "plans",
      key: "id",
    },
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

const MaxChat = sequelize.define("max_chat", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // unique — иначе MaxChat.upsert({userId, chatId}) в bot_started не находит,
  // с чем конфликтовать по ON CONFLICT, и на каждый повторный /start плодит
  // дублирующиеся строки (а значит и дублирующиеся уведомления в notify.service).
  userId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: false,
    unique: true,
  },
  chatId: { type: DataTypes.STRING, allowNull: false },
});

// Состояние диалога (FSM) MAX-бота: на каком шаге какого сценария
// находится конкретный chatId и что уже успел собрать (черновик).
const MaxBotSession = sequelize.define("max_bot_sessions", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  chatId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: false,
  },
  scenario: {
    type: DataTypes.STRING,
    defaultValue: "idle", // idle | start_work | complete_work | chat
  },
  step: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  applicationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
});

// Короткоживущий одноразовый токен для привязки MAX-аккаунта через
// deep link (?start=...). См. utils/maxBindToken.js — MAX не передаёт
// payload диплинка длиннее 128 символов, поэтому сам userId тут не
// хранится в токене, а лежит рядом в этой таблице.
const MaxBindToken = sequelize.define("max_bind_tokens", {
  token: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

const Plan = sequelize.define("plans", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pricePerMonth: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  pricePerDay: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  maxIntegrators: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

const Payment = sequelize.define("payments", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  paymentRef: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  source: {
    type: DataTypes.STRING,
    defaultValue: "manual",
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
  additionalWork: {
    type: DataTypes.TEXT,
    comment: "Дополнительные работы",
  },
  actSigned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  qrCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: false,
  },
  companyId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: true,
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

const Invitation = sequelize.define("invitations", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  rejected: {
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
  companyId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: false,
  },
});

User.hasMany(PushToken, { foreignKey: "userId" });
PushToken.belongsTo(User, { foreignKey: "userId" });

User.hasOne(MaxChat);
MaxChat.belongsTo(User);

User.hasOne(MaxBotSession);
MaxBotSession.belongsTo(User);

User.belongsTo(Plan, { foreignKey: "planId" });
Plan.hasMany(User, { foreignKey: "planId" });

User.hasMany(Payment, { foreignKey: "userId" });
Payment.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Application, { foreignKey: "userId", as: "assignedApplications" });
Application.belongsTo(User, { foreignKey: "userId", as: "integrator" });

User.hasMany(Invitation, { foreignKey: "userId", as: "userInvitations" });
Invitation.belongsTo(User, { foreignKey: "userId", as: "integrator" });

User.hasMany(Invitation, { foreignKey: "companyId", as: "companyInvitations" });
Invitation.belongsTo(User, { foreignKey: "companyId", as: "info" });

User.hasMany(Application, {
  foreignKey: "companyId",
  as: "companyApplications",
});
Application.belongsTo(User, { foreignKey: "companyId", as: "company" });

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
  MaxChat,
  MaxBotSession,
  MaxBindToken,
  Payment,
  Plan,
  Application,
  ApplicationCompletion,
  ApplicationCompletionEquipment,
  ApplicationCompletionPhoto,
  Chat,
  Message,
  Invitation,
};

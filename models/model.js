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
  clientBio: {
    type: DataTypes.STRING,
  },
  clientPhone: {
    type: DataTypes.STRING,
  },
  clientType: {
    type: DataTypes.STRING,
  },
  city: {
    type: DataTypes.STRING,
  },
  type: {
    type: DataTypes.STRING,
  },
  monitoringType: {
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
  userId: {
    type: DataTypes.STRING,
    references: {
      model: User,
      key: "id",
    },
    allowNull: false
  },
});

User.hasMany(Application, { foreignKey: 'userId' })
Application.belongsTo(User, { foreignKey: 'userId' })

module.exports = {
  User,
  Application,
};

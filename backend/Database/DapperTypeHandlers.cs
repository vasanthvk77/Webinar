using System.Data;
using Dapper;

namespace WebinarApi.Database
{
    /// <summary>
    /// Dapper type handler for DateOnly
    /// Converts between DateOnly and SQL Date type
    /// </summary>
    public class DateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly>
    {
        public override DateOnly Parse(object value)
        {
            return value switch
            {
                DateTime dt => DateOnly.FromDateTime(dt),
                DateOnly dateOnly => dateOnly,
                string str => DateOnly.Parse(str),
                _ => throw new InvalidCastException($"Cannot convert {value.GetType()} to DateOnly")
            };
        }

        public override void SetValue(IDbDataParameter parameter, DateOnly value)
        {
            parameter.DbType = DbType.Date;
            parameter.Value = value.ToDateTime(TimeOnly.MinValue);
        }
    }

    /// <summary>
    /// Dapper type handler for TimeOnly
    /// Converts between TimeOnly and SQL Time type
    /// </summary>
    public class TimeOnlyTypeHandler : SqlMapper.TypeHandler<TimeOnly>
    {
        public override TimeOnly Parse(object value)
        {
            return value switch
            {
                TimeSpan ts => TimeOnly.FromTimeSpan(ts),
                DateTime dt => TimeOnly.FromDateTime(dt),
                TimeOnly timeOnly => timeOnly,
                string str => TimeOnly.Parse(str),
                _ => throw new InvalidCastException($"Cannot convert {value.GetType()} to TimeOnly")
            };
        }

        public override void SetValue(IDbDataParameter parameter, TimeOnly value)
        {
            parameter.DbType = DbType.Time;
            parameter.Value = value.ToTimeSpan();
        }
    }

    /// <summary>
    /// Dapper type handler for DateTime
    /// Ensures all DateTime values read from SQL Server have DateTimeKind.Utc
    /// and are serialized to JSON with the 'Z' ISO-8601 suffix.
    /// </summary>
    public class DateTimeUtcTypeHandler : SqlMapper.TypeHandler<DateTime>
    {
        public override DateTime Parse(object value)
        {
            if (value is DateTime dt)
            {
                return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
            }
            if (DateTime.TryParse(value?.ToString(), null, System.Globalization.DateTimeStyles.AdjustToUniversal, out var parsed))
            {
                return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
            }
            throw new InvalidCastException($"Cannot convert {value?.GetType()} to DateTime");
        }

        public override void SetValue(IDbDataParameter parameter, DateTime value)
        {
            parameter.DbType = DbType.DateTime2;
            parameter.Value = DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }
    }
}

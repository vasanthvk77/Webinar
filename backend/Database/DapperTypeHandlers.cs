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
}

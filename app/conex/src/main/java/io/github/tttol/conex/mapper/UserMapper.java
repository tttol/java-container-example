package io.github.tttol.conex.mapper;

import io.github.tttol.conex.model.User;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface UserMapper {
    List<User> findAll();
}
